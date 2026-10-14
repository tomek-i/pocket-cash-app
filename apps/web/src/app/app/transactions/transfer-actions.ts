'use server'

import {
  accounts,
  alias,
  and,
  asc,
  categories,
  db,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lt,
  lte,
  ne,
  sql,
  transactions,
  transferDismissals,
} from '@repo/database'
import { revalidatePath } from 'next/cache'
import {
  dismissalKey,
  type TransferCandidate as PairCandidate,
  pickTransferPairs,
  type TransferSuggestion,
} from './_lib/transfer-matching'
import type { MutationResult } from './actions'

/** The transaction handle Drizzle passes to `db.transaction(async (tx) => …)`. */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

/** The default category many users already file their transfers under. */
const TRANSFERS_CATEGORY = 'Transfers'

/** How far apart the two sides of a transfer may be booked, in days. */
const PAIR_WINDOW_DAYS = 5

/** Every page whose totals or rows change when a transfer is marked. */
function revalidateTransferViews(ids: string[]): void {
  revalidatePath('/app')
  revalidatePath('/app/transactions')
  revalidatePath('/app/transactions/transfers')
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
  const res = await db.transaction((tx) => linkPair(tx, transactionId, counterpartId))
  if ('error' in res) return res
  revalidateTransferViews([transactionId, counterpartId])
  return { ok: true }
}

/** Check two transactions can be one transfer, then link them both ways. */
async function linkPair(tx: Tx, aId: string, bId: string): Promise<MutationResult> {
  const rows = await tx
    .select({
      id: transactions.id,
      accountId: transactions.accountId,
      amount: transactions.amount,
      transferPairId: transactions.transferPairId,
    })
    .from(transactions)
    .where(inArray(transactions.id, [aId, bId]))
  const a = rows.find((r) => r.id === aId)
  const b = rows.find((r) => r.id === bId)
  if (!a || !b) return { error: 'Unknown transaction' }
  if (a.accountId === b.accountId) return { error: 'Both sides are in the same account' }
  if (a.amount !== -b.amount) return { error: 'The amounts do not cancel out' }
  if (a.transferPairId || b.transferPairId) return { error: 'Already linked to a transfer' }

  const now = new Date()
  await tx
    .update(transactions)
    .set({ isTransfer: true, transferPairId: b.id, updatedAt: now })
    .where(eq(transactions.id, a.id))
  await tx
    .update(transactions)
    .set({ isTransfer: true, transferPairId: a.id, updatedAt: now })
    .where(eq(transactions.id, b.id))
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

// ── Suggestions ───────────────────────────────────────────────────────────────

/**
 * Upper bound on raw amount matches looked at in one pass. Common small amounts
 * (two $5 coffees in two accounts) multiply, so this keeps a pathological
 * history from stalling the page. Real transfers almost always fit well inside.
 */
const CANDIDATE_CAP = 5000

/** A row filed under Transfers that is not marked and has no suggested partner. */
export interface OneSidedTransfer {
  id: string
  date: string
  description: string
  displayName: string | null
  amount: number
  currency: string
  accountName: string
}

export interface TransferSuggestions {
  pairs: TransferSuggestion[]
  /** Filed under the Transfers category but not marked as a transfer yet. */
  oneSided: OneSidedTransfer[]
}

async function transfersCategoryId(): Promise<string | null> {
  const row = await db.query.categories.findFirst({
    where: eq(categories.name, TRANSFERS_CATEGORY),
    columns: { id: true },
  })
  return row?.id ?? null
}

/**
 * Pairs of transactions that look like one transfer between two of the user's
 * accounts: opposite amounts, different accounts, booked within a few days,
 * neither linked yet. Matched across everything already imported, so it does
 * not matter which account was imported first.
 */
export async function listTransferSuggestions(): Promise<TransferSuggestions> {
  const out = alias(transactions, 'out_txn')
  const inn = alias(transactions, 'in_txn')
  const outAccount = alias(accounts, 'out_account')
  const inAccount = alias(accounts, 'in_account')

  const [categoryId, rows, dismissedRows] = await Promise.all([
    transfersCategoryId(),
    db
      .select({
        outId: out.id,
        outDate: out.date,
        outDescription: out.description,
        outDisplayName: out.displayName,
        outIsTransfer: out.isTransfer,
        outCategoryId: out.categoryId,
        outAccountName: outAccount.name,
        inId: inn.id,
        inDate: inn.date,
        inDescription: inn.description,
        inDisplayName: inn.displayName,
        inIsTransfer: inn.isTransfer,
        inCategoryId: inn.categoryId,
        inAccountName: inAccount.name,
        amount: inn.amount,
        currency: inn.currency,
      })
      .from(out)
      .innerJoin(
        inn,
        and(
          eq(inn.amount, sql`-${out.amount}`),
          eq(inn.currency, out.currency),
          ne(inn.accountId, out.accountId),
          sql`abs(${inn.date}::date - ${out.date}::date) <= ${PAIR_WINDOW_DAYS}`,
          isNull(inn.transferPairId),
        ),
      )
      .innerJoin(outAccount, eq(outAccount.id, out.accountId))
      .innerJoin(inAccount, eq(inAccount.id, inn.accountId))
      .where(and(lt(out.amount, 0), isNull(out.transferPairId)))
      .orderBy(desc(out.date))
      .limit(CANDIDATE_CAP),
    db
      .select({ outId: transferDismissals.outId, inId: transferDismissals.inId })
      .from(transferDismissals),
  ])

  const candidates: PairCandidate[] = rows.map((r) => ({
    out: {
      id: r.outId,
      date: r.outDate,
      description: r.outDescription,
      displayName: r.outDisplayName,
      accountName: r.outAccountName,
      flagged: r.outIsTransfer || (categoryId !== null && r.outCategoryId === categoryId),
    },
    in: {
      id: r.inId,
      date: r.inDate,
      description: r.inDescription,
      displayName: r.inDisplayName,
      accountName: r.inAccountName,
      flagged: r.inIsTransfer || (categoryId !== null && r.inCategoryId === categoryId),
    },
    amount: r.amount,
    currency: r.currency,
  }))
  const dismissed = new Set(dismissedRows.map((d) => dismissalKey(d.outId, d.inId)))
  const pairs = pickTransferPairs(candidates, dismissed)

  let oneSided: OneSidedTransfer[] = []
  if (categoryId) {
    const suggested = new Set(pairs.flatMap((p) => [p.out.id, p.in.id]))
    const filed = await db
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
      .where(and(eq(transactions.categoryId, categoryId), eq(transactions.isTransfer, false)))
      .orderBy(desc(transactions.date))
    oneSided = filed.filter((r) => !suggested.has(r.id))
  }

  return { pairs, oneSided }
}

/** How many suggestions are waiting, for the links that point at the review page. */
export async function countTransferSuggestions(): Promise<number> {
  const { pairs, oneSided } = await listTransferSuggestions()
  return pairs.length + oneSided.length
}

/** Link each confirmed pair. Pairs that no longer fit are skipped, not fatal. */
export async function confirmTransferPairs(
  pairs: { outId: string; inId: string }[],
): Promise<{ ok: true; linked: number } | { error: string }> {
  if (pairs.length === 0) return { ok: true, linked: 0 }
  let linked = 0
  await db.transaction(async (tx) => {
    for (const p of pairs) {
      if (p.outId === p.inId) continue
      const res = await linkPair(tx, p.outId, p.inId)
      if ('ok' in res) linked += 1
    }
  })
  revalidateTransferViews([])
  return { ok: true, linked }
}

/** Remember that a suggested pair is not a transfer, so it is not offered again. */
export async function dismissTransferPair(outId: string, inId: string): Promise<MutationResult> {
  await db.insert(transferDismissals).values({ outId, inId }).onConflictDoNothing()
  revalidatePath('/app/transactions/transfers')
  revalidatePath('/app/transactions')
  return { ok: true }
}

/** Mark several transactions as one-sided transfers in one go. */
export async function markAsTransfers(ids: string[]): Promise<MutationResult> {
  if (ids.length === 0) return { ok: true }
  for (let i = 0; i < ids.length; i += 1000) {
    await db
      .update(transactions)
      .set({ isTransfer: true, updatedAt: new Date() })
      .where(inArray(transactions.id, ids.slice(i, i + 1000)))
  }
  revalidateTransferViews([])
  return { ok: true }
}
