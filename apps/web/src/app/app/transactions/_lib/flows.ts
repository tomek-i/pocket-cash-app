import { eq, sql, transactions } from '@repo/database'

/**
 * The money roll-ups every report shares. A transfer between the user's own
 * accounts is neither income nor spending, so it is left out of both and summed
 * on its own. It still counts towards account balances, which sum `amount`
 * directly and never go through these.
 */

/** WHERE clause for queries that should only see real income and spending. */
export const notTransfer = eq(transactions.isTransfer, false)

/** Money in, excluding transfers. */
export const incomeSum = sql<string>`coalesce(sum(case when ${transactions.amount} > 0 and not ${transactions.isTransfer} then ${transactions.amount} else 0 end), 0)`

/** Money out as a positive figure, excluding transfers. */
export const spendingSum = sql<string>`coalesce(sum(case when ${transactions.amount} < 0 and not ${transactions.isTransfer} then -${transactions.amount} else 0 end), 0)`

/**
 * Signed net of transfers. A linked pair nets to zero, so what is left is money
 * that moved to or from accounts the app does not track.
 */
export const transferNetSum = sql<string>`coalesce(sum(case when ${transactions.isTransfer} then ${transactions.amount} else 0 end), 0)`
