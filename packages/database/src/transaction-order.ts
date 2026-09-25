import { desc } from 'drizzle-orm'
import { transactions } from './schema'

/**
 * The newest-first ordering every transaction list uses.
 *
 * The `id` at the end is not decoration. A CSV import inserts its rows inside
 * one transaction, so `created_at` defaults to the same `now()` for all of them,
 * and a day's rows share a `date` too. That leaves most of the list tied on both
 * sort keys, and Postgres may return tied rows in any order it likes, which in
 * practice is heap order. Updating a row rewrites its tuple, so categorising one
 * moved it (and shuffled others) on the next read: the list jumped under the
 * cursor while you worked through it.
 *
 * `id` is a unique column, so adding it makes the ordering total and stable
 * across writes. It is random, so the order within a tied group is arbitrary,
 * but it is the *same* arbitrary order every time.
 */
export const transactionListOrder = [
  desc(transactions.date),
  desc(transactions.createdAt),
  desc(transactions.id),
]
