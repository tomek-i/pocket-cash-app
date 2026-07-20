'use server'

import {
  and,
  asc,
  type Category,
  categories,
  count,
  db,
  desc,
  eq,
  getTableColumns,
  gte,
  lte,
  sql,
  transactions,
} from '@repo/database'
import { createCategorySchema, updateCategorySchema } from '@repo/validation'
import { revalidatePath } from 'next/cache'
import { type ActionState, isUniqueViolation } from '@/lib/action-state'
import { DEFAULT_CATEGORIES } from './default-categories'

/** Insert the starter category set, skipping any whose name already exists. */
export async function seedDefaultCategories(): Promise<{ added: number }> {
  const inserted = await db
    .insert(categories)
    .values(
      DEFAULT_CATEGORIES.map((c) => ({
        name: c.name,
        icon: c.icon,
        color: c.color,
      })),
    )
    .onConflictDoNothing()
    .returning({ id: categories.id })
  revalidatePath('/app/categories')
  return { added: inserted.length }
}

export async function listCategories(): Promise<Category[]> {
  return db.select().from(categories).orderBy(asc(categories.name))
}

export type CategoryWithStats = Category & {
  /** Number of transactions linked to this category (within the scope). */
  transactionCount: number
  /** Net sum of those transactions, in minor units (signed). */
  totalAmount: number
}

export type CategorySort = 'name' | 'count' | 'amount'

export interface CategoryStatsOptions {
  /** Inclusive lower/upper date bounds (YYYY-MM-DD) to scope the stats. */
  from?: string
  to?: string
  /** name = A–Z; count = most transactions; amount = largest net movement. */
  sort?: CategorySort
}

/**
 * Categories with per-category transaction stats (count + net amount), for the
 * categories list. The optional date bounds are applied in the JOIN (not the
 * WHERE) so categories with no transactions in range still appear with zeros.
 */
export async function listCategoriesWithStats(
  options: CategoryStatsOptions = {},
): Promise<CategoryWithStats[]> {
  const { from, to, sort = 'name' } = options

  const joinScope = and(
    eq(transactions.categoryId, categories.id),
    from ? gte(transactions.date, from) : undefined,
    to ? lte(transactions.date, to) : undefined,
  )

  const transactionCount = count(transactions.id)
  const totalAmount = sql<string>`coalesce(sum(${transactions.amount}), 0)`
  const orderBy =
    sort === 'count'
      ? [desc(transactionCount), asc(categories.name)]
      : sort === 'amount'
        ? [desc(sql`abs(${totalAmount})`), asc(categories.name)]
        : [asc(categories.name)]

  const rows = await db
    .select({ ...getTableColumns(categories), transactionCount, totalAmount })
    .from(categories)
    .leftJoin(transactions, joinScope)
    .groupBy(categories.id)
    .orderBy(...orderBy)

  return rows.map(({ totalAmount: total, transactionCount: cnt, ...category }) => ({
    ...category,
    transactionCount: Number(cnt),
    totalAmount: Number(total),
  }))
}

export async function createCategory(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = {
    name: String(formData.get('name') ?? ''),
    color: String(formData.get('color') ?? ''),
    icon: String(formData.get('icon') ?? ''),
  }
  const parsed = createCategorySchema.safeParse(values)
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors, values }

  try {
    await db.insert(categories).values({
      name: parsed.data.name,
      color: parsed.data.color ?? null,
      icon: parsed.data.icon ?? null,
    })
  } catch (error) {
    if (isUniqueViolation(error))
      return { errors: { name: ['A category with this name already exists'] }, values }
    throw error
  }
  revalidatePath('/app/categories')
  return { ok: true }
}

export async function updateCategory(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = {
    name: String(formData.get('name') ?? ''),
    color: String(formData.get('color') ?? ''),
    icon: String(formData.get('icon') ?? ''),
  }
  const parsed = updateCategorySchema.safeParse({ id: formData.get('id'), ...values })
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors, values }

  try {
    await db
      .update(categories)
      .set({
        name: parsed.data.name,
        color: parsed.data.color ?? null,
        icon: parsed.data.icon ?? null,
        updatedAt: new Date(),
      })
      .where(eq(categories.id, parsed.data.id))
  } catch (error) {
    if (isUniqueViolation(error))
      return { errors: { name: ['A category with this name already exists'] }, values }
    throw error
  }
  revalidatePath('/app/categories')
  return { ok: true }
}

export async function deleteCategory(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = formData.get('id')
  if (typeof id !== 'string') return { errors: { id: ['Missing id'] } }

  await db.delete(categories).where(eq(categories.id, id))
  revalidatePath('/app/categories')
  // Transactions/subscriptions keep their row; the FK nulls their category link.
  revalidatePath('/app/transactions')
  return { ok: true }
}
