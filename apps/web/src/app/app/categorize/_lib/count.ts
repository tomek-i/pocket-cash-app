import { and, db, eq, isNull, sql, transactions } from '@repo/database'

/** How many transactions still have no category. A transfer needs none. */
export async function countUncategorised(): Promise<number> {
  const [row] = await db
    .select({ count: sql<string>`count(*)` })
    .from(transactions)
    .where(and(isNull(transactions.categoryId), eq(transactions.isTransfer, false)))
  return Number(row?.count ?? 0)
}
