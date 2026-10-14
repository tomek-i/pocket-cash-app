import { db, isNull, sql, transactions } from '@repo/database'

/** How many transactions still have no category. */
export async function countUncategorised(): Promise<number> {
  const [row] = await db
    .select({ count: sql<string>`count(*)` })
    .from(transactions)
    .where(isNull(transactions.categoryId))
  return Number(row?.count ?? 0)
}
