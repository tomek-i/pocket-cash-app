'use server'

import {
  addBucket,
  BUCKET_DEFINITIONS,
  BUDGET_BUCKET_TYPES,
  type BucketKind,
  type BucketShare,
  type BudgetBucketType,
  type BudgetPresetId,
  bucketCaps,
  FULL_SHARE,
  getPreset,
  isBudgetBucketType,
  matchPreset,
  normaliseShares,
  presetShares,
  removeBucket,
  sortShares,
} from '@repo/budget'
import {
  asc,
  type BudgetIncome,
  budgetBucketCategories,
  budgetBuckets,
  budgetIncomes,
  categories,
  db,
  eq,
} from '@repo/database'
import {
  budgetCategoryAssignmentSchema,
  budgetSharesSchema,
  createBudgetIncomeSchema,
  renameBudgetBucketSchema,
  updateBudgetIncomeSchema,
} from '@repo/validation'
import { revalidatePath } from 'next/cache'
import type { ActionState } from '@/lib/action-state'
import { getDefaultCurrency } from '../settings/actions'

const BUDGET_PATH = '/app/budget'

export interface BudgetCategory {
  id: string
  name: string
  color: string | null
  icon: string | null
  /** The active bucket it counts towards, or null. */
  bucketType: BudgetBucketType | null
  /** Left out of the budget on purpose: income, transfers. Never unbudgeted. */
  excluded: boolean
}

export interface BudgetBucketView {
  type: BudgetBucketType
  kind: BucketKind
  /** What the bucket is called on screen: the user's rename, or the default. */
  label: string
  defaultLabel: string
  description: string
  /** The user's rename, or null. */
  customLabel: string | null
  share: number
  /** Dollar cap in minor units: the share of the total income. */
  cap: number
  categories: BudgetCategory[]
}

export interface BudgetPlan {
  currency: string
  incomes: BudgetIncome[]
  totalIncome: number
  buckets: BudgetBucketView[]
  /** Bucket types not in the plan, that can be added. */
  availableTypes: BudgetBucketType[]
  /** The preset the split matches, `custom`, or null when there is no plan yet. */
  preset: BudgetPresetId | 'custom' | null
  categories: BudgetCategory[]
  unbudgeted: BudgetCategory[]
}

/** Every bucket type has a row, so shares and category links always have a target. */
async function ensureBucketRows(): Promise<void> {
  await db
    .insert(budgetBuckets)
    .values(BUDGET_BUCKET_TYPES.map((type) => ({ type })))
    .onConflictDoNothing()
}

async function activeShares(): Promise<BucketShare[]> {
  const rows = await db.select().from(budgetBuckets).where(eq(budgetBuckets.active, true))
  return sortShares(rows.map((row) => ({ type: row.type, share: row.shareBps })))
}

/** Make exactly these buckets the plan, with these shares. */
async function writeShares(shares: BucketShare[]): Promise<void> {
  await ensureBucketRows()
  const next = new Map(normaliseShares(shares).map((s) => [s.type, s.share]))
  await db.transaction(async (tx) => {
    for (const type of BUDGET_BUCKET_TYPES) {
      const share = next.get(type)
      await tx
        .update(budgetBuckets)
        .set({ active: share !== undefined, shareBps: share ?? 0, updatedAt: new Date() })
        .where(eq(budgetBuckets.type, type))
    }
  })
  revalidatePath(BUDGET_PATH)
}

export async function getBudgetPlan(): Promise<BudgetPlan> {
  const [currency, incomes, bucketRows, links, categoryRows] = await Promise.all([
    getDefaultCurrency(),
    db.select().from(budgetIncomes).orderBy(asc(budgetIncomes.createdAt)),
    db.select().from(budgetBuckets),
    db.select().from(budgetBucketCategories),
    db
      .select({
        id: categories.id,
        name: categories.name,
        color: categories.color,
        icon: categories.icon,
      })
      .from(categories)
      .orderBy(asc(categories.name)),
  ])

  const totalIncome = incomes.reduce((sum, income) => sum + income.amount, 0)
  const shares = sortShares(
    bucketRows.filter((row) => row.active).map((row) => ({ type: row.type, share: row.shareBps })),
  )
  const active = new Set(shares.map((s) => s.type))
  const linkByCategory = new Map(links.map((link) => [link.categoryId, link.bucketType]))

  // A category linked to a bucket that is not in the plan counts as unbudgeted,
  // and comes back to its bucket if that bucket is added again.
  const allCategories: BudgetCategory[] = categoryRows.map((category) => {
    const linked = linkByCategory.get(category.id)
    return {
      ...category,
      bucketType: linked && active.has(linked) ? linked : null,
      excluded: linkByCategory.has(category.id) && linked === null,
    }
  })

  const buckets = bucketCaps(totalIncome, shares).map(({ type, share, cap }) => {
    const definition = BUCKET_DEFINITIONS[type]
    const customLabel = bucketRows.find((row) => row.type === type)?.label ?? null
    return {
      type,
      kind: definition.kind,
      label: customLabel ?? definition.label,
      defaultLabel: definition.label,
      description: definition.description,
      customLabel,
      share,
      cap,
      categories: allCategories.filter((category) => category.bucketType === type),
    }
  })

  return {
    currency,
    incomes,
    totalIncome,
    buckets,
    availableTypes: BUDGET_BUCKET_TYPES.filter((type) => !active.has(type)),
    preset: shares.length > 0 ? matchPreset(shares) : null,
    categories: allCategories,
    unbudgeted: allCategories.filter(
      (category) => category.bucketType === null && !category.excluded,
    ),
  }
}

// ── Incomes ──────────────────────────────────────────────────────────────────

function incomeValues(formData: FormData) {
  return {
    name: String(formData.get('name') ?? ''),
    amount: String(formData.get('amount') ?? ''),
  }
}

export async function createBudgetIncome(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const values = incomeValues(formData)
  const parsed = createBudgetIncomeSchema.safeParse(values)
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors, values }

  await db.insert(budgetIncomes).values(parsed.data)
  revalidatePath(BUDGET_PATH)
  return { ok: true }
}

export async function updateBudgetIncome(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const values = incomeValues(formData)
  const parsed = updateBudgetIncomeSchema.safeParse({ id: formData.get('id'), ...values })
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors, values }

  await db
    .update(budgetIncomes)
    .set({ name: parsed.data.name, amount: parsed.data.amount, updatedAt: new Date() })
    .where(eq(budgetIncomes.id, parsed.data.id))
  revalidatePath(BUDGET_PATH)
  return { ok: true }
}

export async function deleteBudgetIncome(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = formData.get('id')
  if (typeof id !== 'string') return { errors: { id: ['Missing id'] } }

  await db.delete(budgetIncomes).where(eq(budgetIncomes.id, id))
  revalidatePath(BUDGET_PATH)
  return { ok: true }
}

// ── Buckets ──────────────────────────────────────────────────────────────────

/** Replace the plan with a preset. Category assignments are kept. */
export async function applyBudgetPreset(presetId: string): Promise<void> {
  const preset = getPreset(presetId)
  if (!preset) throw new Error(`Unknown preset: ${presetId}`)
  await writeShares(presetShares(preset))
}

/**
 * Save the dialled shares. Only buckets already in the plan are accepted, so a
 * save racing a preset switch cannot bring a removed bucket back.
 */
export async function saveBudgetShares(input: BucketShare[]): Promise<{ ok: boolean }> {
  const parsed = budgetSharesSchema.safeParse(input)
  if (!parsed.success) return { ok: false }
  const shares: BucketShare[] = []
  for (const { type, share } of parsed.data) {
    if (!isBudgetBucketType(type) || shares.some((s) => s.type === type)) return { ok: false }
    shares.push({ type, share })
  }
  // Under 100% is fine (the rest is unallocated). Over never is.
  if (shares.reduce((sum, s) => sum + s.share, 0) > FULL_SHARE) return { ok: false }

  const current = await activeShares()
  const sameBuckets =
    current.length === shares.length && current.every((s) => shares.some((p) => p.type === s.type))
  if (!sameBuckets) return { ok: false }

  await writeShares(shares)
  return { ok: true }
}

export async function addBudgetBucket(type: string): Promise<void> {
  if (!isBudgetBucketType(type)) throw new Error(`Unknown bucket: ${type}`)
  await writeShares(addBucket(await activeShares(), type))
}

export async function removeBudgetBucket(type: string): Promise<void> {
  if (!isBudgetBucketType(type)) throw new Error(`Unknown bucket: ${type}`)
  await writeShares(removeBucket(await activeShares(), type))
}

export async function renameBudgetBucket(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const values = {
    type: String(formData.get('type') ?? ''),
    label: String(formData.get('label') ?? ''),
  }
  const parsed = renameBudgetBucketSchema.safeParse(values)
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors, values }
  const { type, label } = parsed.data
  if (!isBudgetBucketType(type)) return { errors: { type: ['Unknown bucket'] }, values }

  // Saving the default name stores nothing, so a later rename of the default
  // (should the app ever change it) still shows through.
  const customLabel = label && label !== BUCKET_DEFINITIONS[type].label ? label : null
  await ensureBucketRows()
  await db
    .update(budgetBuckets)
    .set({ label: customLabel, updatedAt: new Date() })
    .where(eq(budgetBuckets.type, type))
  revalidatePath(BUDGET_PATH)
  return { ok: true }
}

// ── Categories ───────────────────────────────────────────────────────────────

/** Where a category can go: a bucket, left out on purpose, or undecided (null). */
export type CategoryPlacement = BudgetBucketType | 'excluded' | null

/** Put a category in a bucket, leave it out of the budget, or make it undecided again. */
export async function assignCategoryToBucket(
  categoryId: string,
  placement: CategoryPlacement,
): Promise<void> {
  if (!budgetCategoryAssignmentSchema.safeParse({ categoryId, bucketType: placement }).success)
    throw new Error('Invalid category')

  if (placement === null) {
    await db.delete(budgetBucketCategories).where(eq(budgetBucketCategories.categoryId, categoryId))
  } else {
    if (placement !== 'excluded' && !isBudgetBucketType(placement))
      throw new Error(`Unknown bucket: ${placement}`)
    const bucketType = placement === 'excluded' ? null : placement
    await ensureBucketRows()
    await db
      .insert(budgetBucketCategories)
      .values({ categoryId, bucketType })
      .onConflictDoUpdate({ target: budgetBucketCategories.categoryId, set: { bucketType } })
  }
  revalidatePath(BUDGET_PATH)
}
