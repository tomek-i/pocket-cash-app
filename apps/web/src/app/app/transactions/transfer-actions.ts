'use server'

import {
  accounts,
  and,
  asc,
  db,
  eq,
  gte,
  inArray,
  isNull,
  lte,
  ne,
  sql,
  transactions,
} from '@repo/database'
import { revalidatePath } from 'next/cache'
import type { MutationResult } from './actions'

/** How far apart the two sides of a transfer may be booked, in days. */
const PAIR_WINDOW_DAYS = 5

/** Every page whose totals or rows change when a transfer is marked. */
function revalidateTransferViews(ids: string[]): void {
  revalidatePath('/app')
  revalidatePath('/app/transactions')
  for (const id of ids) revalidatePath(`/app/transactions/${id}`)
  revalidatePath('/app/reports')
  revalidatePath('/app/reports/[fy]', 'page')
  revalidatePath('/app/subscriptions')
}

function addDays(isoDate: string, days: number): string {
  const next = new Date(`${isoDate}T00:00:00Z`)
  next.setUTCDate(next.getUTCDate() + days)
  return next.toISOString().slice(0, 10)
}

/**
 * Mark a transaction as a transfer between the user's own accounts, or clear the
 * mark. Clearing also unlinks the other side, which stays marked as a transfer.
 */
export async function setTransfer(
  transactionId: string,
  isTransfer: boolean,
): Promise<MutationResult> {
  const row = await db.query.transactions.findFirst({
    where: eq(transactions.id, transactionId),
    columns: { id: true, transferPairId: true },
  })
  if (!row) return { error: 'Unknown transaction' }

  const touched = [row.id]
  await db.transaction(async (tx) => {
    if (!isTransfer && row.transferPairId) {
      touched.push(row.transferPairId)
      await tx
        .update(transactions)
        .set({ transferPairId: null, updatedAt: new Date() })
        .where(eq(transactions.id, row.transferPairId))
    }
    await tx
      .update(transactions)
      .set({
        isTransfer,
        ...(isTransfer ? {} : { transferPairId: null }),
        updatedAt: new Date(),
      })
      .where(eq(transactions.id, row.id))
  })
  revalidateTransferViews(touched)
  return { ok: true }
}

export interface TransferCandidate {
  id: string
  date: string
  description: string
  displayName: string | null
  amount: number
  currency: string
  accountName: string
}

/**
 * Transactions that could be the other side of this one: the opposite amount, in
 * a different account, booked within a few days, and not linked to anything yet.
 * Closest date first.
 */
export async function findTransferCounterparts(
  transactionId: string,
): Promise<TransferCandidate[]> {
  const target = await db.query.transactions.findFirst({
    where: eq(transactions.id, transactionId),
    columns: { id: true, accountId: true, date: true, amount: true, currency: true },
  })
  if (!target || target.amount === 0) return []

  return db
    .select({
      id: transactions.id,
      date: transactions.date,
      description: transactions.description,
      displayName: transactions.displayName,
      amount: transactions.amount,
      currency: transactions.currency,
      accountName: accounts.name,
    })
    .from(transactions)
    .innerJoin(accounts, eq(accounts.id, transactions.accountId))
    .where(
      and(
        ne(transactions.accountId, target.accountId),
        eq(transactions.amount, -target.amount),
        eq(transactions.currency, target.currency),
        gte(transactions.date, addDays(target.date, -PAIR_WINDOW_DAYS)),
        lte(transactions.date, addDays(target.date, PAIR_WINDOW_DAYS)),
        isNull(transactions.transferPairId),
      ),
    )
    .orderBy(sql`abs(${transactions.date}::date - ${target.date}::date)`, asc(transactions.date))
    .limit(10)
}

/**
 * Link two transactions as the two sides of one transfer. Both are marked as
 * transfers. They must be in different accounts and cancel each other out.
 */
export async function linkTransfer(
  transactionId: string,
  counterpartId: string,
): Promise<MutationResult> {
  if (transactionId === counterpartId) return { error: 'Pick a different transaction' }
  const rows = await db
    .select({
      id: transactions.id,
      accountId: transactions.accountId,
      amount: transactions.amount,
      transferPairId: transactions.transferPairId,
    })
    .from(transactions)
    .where(inArray(transactions.id, [transactionId, counterpartId]))
  const a = rows.find((r) => r.id === transactionId)
  const b = rows.find((r) => r.id === counterpartId)
  if (!a || !b) return { error: 'Unknown transaction' }
  if (a.accountId === b.accountId) return { error: 'Both sides are in the same account' }
  if (a.amount !== -b.amount) return { error: 'The amounts do not cancel out' }
  if (a.transferPairId || b.transferPairId) return { error: 'Already linked to a transfer' }

  await db.transaction(async (tx) => {
    const now = new Date()
    await tx
      .update(transactions)
      .set({ isTransfer: true, transferPairId: b.id, updatedAt: now })
      .where(eq(transactions.id, a.id))
    await tx
      .update(transactions)
      .set({ isTransfer: true, transferPairId: a.id, updatedAt: now })
      .where(eq(transactions.id, b.id))
  })
  revalidateTransferViews([a.id, b.id])
  return { ok: true }
}

/** Break the link between two sides. Both stay marked as transfers. */
export async function unlinkTransfer(transactionId: string): Promise<MutationResult> {
  const row = await db.query.transactions.findFirst({
    where: eq(transactions.id, transactionId),
    columns: { id: true, transferPairId: true },
  })
  if (!row) return { error: 'Unknown transaction' }
  if (!row.transferPairId) return { ok: true }

  const ids = [row.id, row.transferPairId]
  await db
    .update(transactions)
    .set({ transferPairId: null, updatedAt: new Date() })
    .where(inArray(transactions.id, ids))
  revalidateTransferViews(ids)
  return { ok: true }
}
