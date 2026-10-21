import {
  and,
  categories,
  db,
  eq,
  financialSubscriptions,
  inArray,
  lt,
  sql,
  transactions,
} from '@repo/database'
import { planCategoryUpdates } from './category-sync'

/** PGlite caps bind parameters, so updates go in chunks. */
const CHUNK = 1000

/**
 * Give matched charges the category of their subscription or bill. Transfers
 * are left alone. `moved` is a subscription whose category just changed, so its
 * charges still in the old one follow it. Returns how many transactions changed.
 */
export async function applySubscriptionCategories(moved?: {
  id: string
  fromCategoryId: string | null
}): Promise<number> {
  const [sources, generic, targets] = await Promise.all([
    db
      .select({
        id: financialSubscriptions.id,
        matcher: financialSubscriptions.matcher,
        categoryId: financialSubscriptions.categoryId,
      })
      .from(financialSubscriptions),
    db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(sql`lower(${categories.name})`, 'subscriptions')),
    db
      .select({
        id: transactions.id,
        merchant: transactions.merchant,
        description: transactions.description,
        categoryId: transactions.categoryId,
      })
      .from(transactions)
      .where(and(lt(transactions.amount, 0), eq(transactions.isTransfer, false))),
  ])

  const genericIds = new Set(generic.map((c) => c.id))
  const canReplace = (categoryId: string, source: { id: string }) =>
    genericIds.has(categoryId) || (source.id === moved?.id && categoryId === moved.fromCategoryId)

  let changed = 0
  for (const [categoryId, ids] of planCategoryUpdates(targets, sources, canReplace)) {
    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK)
      await db
        .update(transactions)
        .set({ categoryId, updatedAt: new Date() })
        .where(inArray(transactions.id, chunk))
      changed += chunk.length
    }
  }
  return changed
}
