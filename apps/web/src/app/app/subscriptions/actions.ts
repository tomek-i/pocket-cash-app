'use server'

import {
  asc,
  type Category,
  categories,
  db,
  eq,
  type FinancialSubscription,
  financialSubscriptions,
  lt,
  transactions,
} from '@repo/database'
import { BILLING_CYCLE_DAYS, type BillingCycle } from '@repo/types'
import { createSubscriptionSchema, updateSubscriptionSchema } from '@repo/validation'
import { revalidatePath } from 'next/cache'
import type { ActionState } from '@/lib/action-state'

export type SubscriptionWithCategory = FinancialSubscription & {
  category: Pick<Category, 'id' | 'name' | 'color'> | null
}

export async function listSubscriptions(): Promise<SubscriptionWithCategory[]> {
  return db.query.financialSubscriptions.findMany({
    with: { category: { columns: { id: true, name: true, color: true } } },
    orderBy: asc(financialSubscriptions.name),
  })
}

/** Verify a category id exists (so we never link to a stale/unknown category). */
async function categoryExists(categoryId: string): Promise<boolean> {
  const row = await db.query.categories.findFirst({
    where: eq(categories.id, categoryId),
    columns: { id: true },
  })
  return Boolean(row)
}

function readForm(formData: FormData) {
  return {
    name: String(formData.get('name') ?? ''),
    amount: String(formData.get('amount') ?? ''),
    currency: String(formData.get('currency') ?? ''),
    cycle: String(formData.get('cycle') ?? 'monthly'),
    nextPaymentDate: String(formData.get('nextPaymentDate') ?? ''),
    categoryId: String(formData.get('categoryId') ?? ''),
    notes: String(formData.get('notes') ?? ''),
  }
}

export async function createSubscription(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const values = readForm(formData)
  const parsed = createSubscriptionSchema.safeParse({
    ...values,
    categoryId: values.categoryId === 'none' ? '' : values.categoryId,
  })
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors, values }
  if (parsed.data.categoryId && !(await categoryExists(parsed.data.categoryId)))
    return { errors: { categoryId: ['Unknown category'] }, values }

  await db.insert(financialSubscriptions).values({
    name: parsed.data.name,
    amount: parsed.data.amount,
    currency: parsed.data.currency,
    cycle: parsed.data.cycle,
    nextPaymentDate: parsed.data.nextPaymentDate ?? null,
    categoryId: parsed.data.categoryId ?? null,
    matcher: parsed.data.matcher ?? null,
    notes: parsed.data.notes ?? null,
  })
  revalidatePath('/app/subscriptions')
  return { ok: true }
}

export async function updateSubscription(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const values = readForm(formData)
  const parsed = updateSubscriptionSchema.safeParse({
    id: formData.get('id'),
    ...values,
    categoryId: values.categoryId === 'none' ? '' : values.categoryId,
  })
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors, values }
  if (parsed.data.categoryId && !(await categoryExists(parsed.data.categoryId)))
    return { errors: { categoryId: ['Unknown category'] }, values }

  await db
    .update(financialSubscriptions)
    .set({
      name: parsed.data.name,
      amount: parsed.data.amount,
      currency: parsed.data.currency,
      cycle: parsed.data.cycle,
      nextPaymentDate: parsed.data.nextPaymentDate ?? null,
      categoryId: parsed.data.categoryId ?? null,
      notes: parsed.data.notes ?? null,
      updatedAt: new Date(),
    })
    .where(eq(financialSubscriptions.id, parsed.data.id))
  revalidatePath('/app/subscriptions')
  return { ok: true }
}

export async function deleteSubscription(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = formData.get('id')
  if (typeof id !== 'string') return { errors: { id: ['Missing id'] } }

  await db.delete(financialSubscriptions).where(eq(financialSubscriptions.id, id))
  revalidatePath('/app/subscriptions')
  return { ok: true }
}

// ── Auto-detection ─────────────────────────────────────────────────────────────

export interface SubscriptionSuggestion {
  name: string
  amount: number // minor units (positive cost)
  currency: string
  cycle: BillingCycle
  nextPaymentDate: string
  matcher: string
  occurrences: number
  lastDate: string
}

/** Group key for a transaction: lowercased letters of merchant/description. */
function normalizeKey(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[0-9]+/g, ' ')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 4)
    .join(' ')
}

function titleCase(value: string): string {
  return value.replace(/\b\w/g, (c) => c.toUpperCase())
}

function median(sorted: number[]): number {
  if (sorted.length === 0) return 0
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2) return sorted[mid] ?? 0
  return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
}

/** Classify a median gap (in days) into a billing cycle, or null if irregular. */
function classifyCycle(gapDays: number): BillingCycle | null {
  if (gapDays >= 5 && gapDays <= 9) return 'weekly'
  if (gapDays >= 25 && gapDays <= 35) return 'monthly'
  if (gapDays >= 82 && gapDays <= 100) return 'quarterly'
  if (gapDays >= 350 && gapDays <= 380) return 'yearly'
  return null
}

const DAY_MS = 86_400_000

function addDays(isoDate: string, days: number): string {
  const next = new Date(`${isoDate}T00:00:00Z`)
  next.setUTCDate(next.getUTCDate() + days)
  return next.toISOString().slice(0, 10)
}

/**
 * Scan outflow transactions for recurring charges and suggest subscriptions.
 * A group qualifies when it has ≥3 charges, a tight amount spread (≤25%), and a
 * regular interval that maps to a billing cycle. Groups already covered by an
 * existing subscription (by matcher) are excluded.
 */
export async function suggestSubscriptions(): Promise<SubscriptionSuggestion[]> {
  const [rows, existing] = await Promise.all([
    db
      .select({
        description: transactions.description,
        merchant: transactions.merchant,
        amount: transactions.amount,
        currency: transactions.currency,
        date: transactions.date,
      })
      .from(transactions)
      .where(lt(transactions.amount, 0)),
    db.select({ matcher: financialSubscriptions.matcher }).from(financialSubscriptions),
  ])

  const existingMatchers = new Set(
    existing.map((e) => e.matcher).filter((m): m is string => Boolean(m)),
  )

  interface Group {
    key: string
    labelCounts: Map<string, number>
    amounts: number[] // abs minor units
    currencyCounts: Map<string, number>
    dates: string[]
  }
  const groups = new Map<string, Group>()

  for (const row of rows) {
    const source = (row.merchant ?? row.description ?? '').trim()
    const key = normalizeKey(source)
    if (!key) continue
    let group = groups.get(key)
    if (!group) {
      group = {
        key,
        labelCounts: new Map(),
        amounts: [],
        currencyCounts: new Map(),
        dates: [],
      }
      groups.set(key, group)
    }
    group.labelCounts.set(source, (group.labelCounts.get(source) ?? 0) + 1)
    group.amounts.push(Math.abs(row.amount))
    group.currencyCounts.set(row.currency, (group.currencyCounts.get(row.currency) ?? 0) + 1)
    group.dates.push(row.date)
  }

  const suggestions: SubscriptionSuggestion[] = []
  for (const group of groups.values()) {
    if (group.amounts.length < 3) continue
    if (existingMatchers.has(group.key)) continue

    const sortedAmounts = [...group.amounts].sort((a, b) => a - b)
    const medAmount = median(sortedAmounts)
    if (medAmount <= 0) continue
    const minAmount = sortedAmounts[0] ?? 0
    const maxAmount = sortedAmounts[sortedAmounts.length - 1] ?? 0
    if ((maxAmount - minAmount) / medAmount > 0.25) continue

    const sortedDates = [...new Set(group.dates)].sort()
    if (sortedDates.length < 3) continue
    const lastDate = sortedDates[sortedDates.length - 1]
    if (!lastDate) continue
    const gaps: number[] = []
    for (let i = 1; i < sortedDates.length; i++) {
      const ms =
        new Date(`${sortedDates[i]}T00:00:00Z`).getTime() -
        new Date(`${sortedDates[i - 1]}T00:00:00Z`).getTime()
      gaps.push(Math.round(ms / DAY_MS))
    }
    const cycle = classifyCycle(median([...gaps].sort((a, b) => a - b)))
    if (!cycle) continue

    const labelEntry = [...group.labelCounts.entries()].sort((a, b) => b[1] - a[1])[0]
    const currencyEntry = [...group.currencyCounts.entries()].sort((a, b) => b[1] - a[1])[0]
    const label = labelEntry?.[0] ?? group.key
    const currency = currencyEntry?.[0] ?? 'USD'

    suggestions.push({
      name: titleCase(label.toLowerCase()).slice(0, 80),
      amount: Math.round(medAmount),
      currency,
      cycle,
      nextPaymentDate: addDays(lastDate, BILLING_CYCLE_DAYS[cycle]),
      matcher: group.key,
      occurrences: group.amounts.length,
      lastDate,
    })
  }

  return suggestions.sort((a, b) => b.occurrences - a.occurrences)
}

export type ApplyResult = { ok: true } | { error: string }

/** Create a subscription from an auto-detected suggestion. */
export async function applySuggestion(input: SubscriptionSuggestion): Promise<ApplyResult> {
  if (!input.name.trim() || input.amount <= 0) return { error: 'Invalid suggestion' }

  await db.insert(financialSubscriptions).values({
    name: input.name.trim().slice(0, 80),
    amount: Math.round(input.amount),
    currency: input.currency,
    cycle: input.cycle,
    nextPaymentDate: input.nextPaymentDate || null,
    matcher: input.matcher || null,
  })
  revalidatePath('/app/subscriptions')
  return { ok: true }
}
