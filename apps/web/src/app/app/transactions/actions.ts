'use server'

import {
  and,
  type Category,
  categories,
  db,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lte,
  ne,
  type SQL,
  sql,
  type Tag,
  tags,
  transactions,
  transactionTags,
} from '@repo/database'
import { createLogger } from '@repo/logger'
import { revalidatePath } from 'next/cache'

const log = createLogger('transactions')

const TRANSACTIONS_PAGE_SIZE = 50

export interface TransactionFilters {
  accountId?: string
  q?: string
  from?: string
  to?: string
  /** A category id, or 'uncategorised' for transactions with no category. */
  category?: string
  /** Only transactions carrying this tag id. */
  tagId?: string
  /** Amount range on the transaction's *magnitude* (absolute value), in minor
   * units — direction-agnostic, so it matches both income and spending. */
  amountMin?: number
  amountMax?: number
  page?: number
}

export interface TransactionRow {
  id: string
  date: string
  description: string
  displayName: string | null
  merchant: string | null
  amount: number
  currency: string
  accountId: string
  account: { name: string; currency: string; bankId: string }
  category: Pick<Category, 'id' | 'name' | 'color' | 'icon'> | null
  tags: Pick<Tag, 'id' | 'name' | 'color'>[]
}

export interface TransactionPage {
  rows: TransactionRow[]
  total: number
  page: number
  pageSize: number
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Build the shared WHERE conditions for both the page query and the count. */
function buildConditions(filters: TransactionFilters): SQL[] {
  const conditions: SQL[] = []
  if (filters.accountId) conditions.push(eq(transactions.accountId, filters.accountId))
  if (filters.from) conditions.push(gte(transactions.date, filters.from))
  if (filters.to) conditions.push(lte(transactions.date, filters.to))
  if (filters.category === 'uncategorised') conditions.push(isNull(transactions.categoryId))
  else if (filters.category && UUID.test(filters.category))
    conditions.push(eq(transactions.categoryId, filters.category))
  if (filters.tagId && UUID.test(filters.tagId)) {
    // Subquery (not raw SQL) so Drizzle aliases the tables correctly inside the
    // relational query too.
    conditions.push(
      inArray(
        transactions.id,
        db
          .select({ id: transactionTags.transactionId })
          .from(transactionTags)
          .where(eq(transactionTags.tagId, filters.tagId)),
      ),
    )
  }
  if (filters.q) {
    const pattern = `%${filters.q}%`
    conditions.push(
      sql`(${transactions.description} ILIKE ${pattern} OR ${transactions.displayName} ILIKE ${pattern} OR ${transactions.merchant} ILIKE ${pattern})`,
    )
  }
  if (filters.amountMin != null)
    conditions.push(sql`abs(${transactions.amount}) >= ${filters.amountMin}`)
  if (filters.amountMax != null)
    conditions.push(sql`abs(${transactions.amount}) <= ${filters.amountMax}`)
  return conditions
}

export async function listTransactions(filters: TransactionFilters): Promise<TransactionPage> {
  const page = Math.max(1, filters.page ?? 1)
  const pageSize = TRANSACTIONS_PAGE_SIZE
  const where = and(...buildConditions(filters))

  const [rows, [counted]] = await Promise.all([
    db.query.transactions.findMany({
      where,
      orderBy: [desc(transactions.date), desc(transactions.createdAt)],
      limit: pageSize,
      offset: (page - 1) * pageSize,
      columns: {
        id: true,
        date: true,
        description: true,
        displayName: true,
        merchant: true,
        amount: true,
        currency: true,
        accountId: true,
      },
      with: {
        account: { columns: { name: true, currency: true, bankId: true } },
        category: { columns: { id: true, name: true, color: true, icon: true } },
        tags: { with: { tag: { columns: { id: true, name: true, color: true } } } },
      },
    }),
    db.select({ count: sql<number>`count(*)::int` }).from(transactions).where(where),
  ])

  return {
    rows: rows.map((r) => ({
      ...r,
      tags: r.tags.map((tt) => tt.tag),
    })),
    total: counted?.count ?? 0,
    page,
    pageSize,
  }
}

/** Hard cap on rows in one CSV export — a safety valve, far above any real FY. */
const EXPORT_ROW_CAP = 20000

function csvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

/**
 * Build a CSV of the actual transactions matching `filters` (all pages, up to a
 * cap). Used by the reports export buttons to dump e.g. every "tax"-tagged row
 * for a financial year. A leading BOM keeps Excel happy with UTF-8.
 */
export async function exportTransactionsCsv(filters: TransactionFilters): Promise<string> {
  const where = and(...buildConditions(filters))

  const rows = await db.query.transactions.findMany({
    where,
    orderBy: [desc(transactions.date), desc(transactions.createdAt)],
    limit: EXPORT_ROW_CAP,
    columns: {
      date: true,
      description: true,
      displayName: true,
      merchant: true,
      amount: true,
      currency: true,
    },
    with: {
      account: { columns: { name: true } },
      category: { columns: { name: true } },
      tags: { with: { tag: { columns: { name: true } } } },
    },
  })

  const header = [
    'Date',
    'Name',
    'Description',
    'Merchant',
    'Category',
    'Tags',
    'Account',
    'Amount',
    'Currency',
  ]
  const lines = [header.join(',')]
  for (const r of rows) {
    lines.push(
      [
        r.date,
        csvCell(r.displayName ?? r.description),
        csvCell(r.description),
        csvCell(r.merchant ?? ''),
        csvCell(r.category?.name ?? ''),
        csvCell(r.tags.map((tt) => tt.tag.name).join('; ')),
        csvCell(r.account.name),
        (r.amount / 100).toFixed(2),
        r.currency,
      ].join(','),
    )
  }
  const BOM = '﻿' // makes Excel read the file as UTF-8
  return BOM + lines.join('\r\n')
}

export type MutationResult = { ok: true } | { error: string }

/** Assign (or clear, with null) a transaction's category. */
export async function setTransactionCategory(
  transactionId: string,
  categoryId: string | null,
): Promise<MutationResult> {
  if (categoryId) {
    const cat = await db.query.categories.findFirst({
      where: eq(categories.id, categoryId),
      columns: { id: true },
    })
    if (!cat) return { error: 'Unknown category' }
  }
  await db
    .update(transactions)
    .set({ categoryId, updatedAt: new Date() })
    .where(eq(transactions.id, transactionId))
  revalidatePath('/app/transactions')
  return { ok: true }
}

/** Add or remove a tag on a transaction. */
export async function toggleTransactionTag(
  transactionId: string,
  tagId: string,
  add: boolean,
): Promise<MutationResult> {
  const tx = await db.query.transactions.findFirst({
    where: eq(transactions.id, transactionId),
    columns: { id: true },
  })
  if (!tx) return { error: 'Unknown transaction' }
  const tag = await db.query.tags.findFirst({
    where: eq(tags.id, tagId),
    columns: { id: true },
  })
  if (!tag) return { error: 'Unknown tag' }

  if (add) {
    await db.insert(transactionTags).values({ transactionId, tagId }).onConflictDoNothing()
  } else {
    await db
      .delete(transactionTags)
      .where(
        and(eq(transactionTags.transactionId, transactionId), eq(transactionTags.tagId, tagId)),
      )
  }
  revalidatePath('/app/transactions')
  return { ok: true }
}

export interface TransactionDetail {
  id: string
  date: string
  valueDate: string | null
  description: string
  displayName: string | null
  merchant: string | null
  amount: number
  currency: string
  balance: number | null
  reference: string | null
  notes: string | null
  rawData: Record<string, string>
  createdAt: Date
  accountId: string
  account: {
    id: string
    name: string
    currency: string
    bankId: string
    bank: { name: string } | null
  }
  category: Pick<Category, 'id' | 'name' | 'color' | 'icon'> | null
  tags: Pick<Tag, 'id' | 'name' | 'color'>[]
}

/** One transaction with its account, bank, category and tags — for the detail page. */
export async function getTransaction(id: string): Promise<TransactionDetail | null> {
  const row = await db.query.transactions.findFirst({
    where: eq(transactions.id, id),
    with: {
      account: {
        columns: { id: true, name: true, currency: true, bankId: true },
        with: { bank: { columns: { name: true } } },
      },
      category: { columns: { id: true, name: true, color: true, icon: true } },
      tags: { with: { tag: { columns: { id: true, name: true, color: true } } } },
    },
  })
  if (!row) return null
  return {
    id: row.id,
    date: row.date,
    valueDate: row.valueDate,
    description: row.description,
    displayName: row.displayName,
    merchant: row.merchant,
    amount: row.amount,
    currency: row.currency,
    balance: row.balance,
    reference: row.reference,
    notes: row.notes,
    rawData: row.rawData,
    createdAt: row.createdAt,
    accountId: row.accountId,
    account: row.account,
    category: row.category,
    tags: row.tags.map((tt) => tt.tag),
  }
}

export async function deleteTransaction(transactionId: string): Promise<MutationResult> {
  await db.delete(transactions).where(eq(transactions.id, transactionId))
  revalidatePath('/app/transactions')
  return { ok: true }
}

/** Set (or clear, with empty string) a transaction's display-name override. */
export async function setTransactionDisplayName(
  transactionId: string,
  displayName: string,
): Promise<MutationResult> {
  const trimmed = displayName.trim()
  await db
    .update(transactions)
    .set({ displayName: trimmed || null, updatedAt: new Date() })
    .where(eq(transactions.id, transactionId))
  revalidatePath(`/app/transactions/${transactionId}`)
  revalidatePath('/app/transactions')
  return { ok: true }
}

export interface SimilarTransaction {
  id: string
  date: string
  description: string
  displayName: string | null
  amount: number
  currency: string
  similarity: number
}

/**
 * Fuzzy-find transactions whose description is similar to the given one, using
 * pg_trgm `similarity()`. `threshold` (0–1) is the minimum trigram similarity.
 * With `includeAmount`, results are additionally restricted to the same amount;
 * by default matching is on the description only.
 */
export async function findSimilarTransactions(input: {
  id: string
  threshold: number
  includeAmount: boolean
}): Promise<SimilarTransaction[]> {
  const target = await db.query.transactions.findFirst({
    where: eq(transactions.id, input.id),
    columns: { description: true, amount: true },
  })
  if (!target) return []

  const threshold = Math.min(1, Math.max(0.05, input.threshold))
  // Compare on descriptions with the trailing reference code stripped (8+ char
  // alphanumeric token containing a digit — e.g. "…Raiz Investment c309e62b8f").
  // Those random tails otherwise tank the trigram score for clearly-related rows.
  const REF_CODE = '[[:space:]]+(?=[[:alnum:]]*[[:digit:]])[[:alnum:]]{8,}$'
  const normCol = sql`regexp_replace(${transactions.description}, ${REF_CODE}, '')`
  const normTarget = sql`regexp_replace(${target.description}, ${REF_CODE}, '')`
  const sim = sql<number>`similarity(${normCol}, ${normTarget})`

  const conditions: SQL[] = [ne(transactions.id, input.id), sql`${sim} >= ${threshold}`]
  if (input.includeAmount) conditions.push(eq(transactions.amount, target.amount))

  try {
    return await db
      .select({
        id: transactions.id,
        date: transactions.date,
        description: transactions.description,
        displayName: transactions.displayName,
        amount: transactions.amount,
        currency: transactions.currency,
        similarity: sim,
      })
      .from(transactions)
      .where(and(...conditions))
      .orderBy(desc(sim))
      .limit(200)
  } catch (error) {
    // Most likely the pg_trgm extension isn't installed yet (migration 0004).
    // Degrade to no results rather than crashing the detail page.
    log.error('similar-transactions search failed (is pg_trgm installed?)', { err: error })
    return []
  }
}

/**
 * Apply the same fields to many transactions at once (from the similar-
 * transactions picker). Each field is optional: omit it to leave it unchanged.
 *  - setDisplayName: '' clears the override; any value sets it.
 *  - setCategoryId: null clears the category; a value sets it.
 *  - addTagIds: tags to ADD (existing tags are kept).
 */
export async function bulkUpdateTransactions(input: {
  ids: string[]
  setDisplayName?: string
  setCategoryId?: string | null
  addTagIds?: string[]
}): Promise<MutationResult> {
  const ids = [...new Set(input.ids)]
  if (ids.length === 0) return { error: 'Nothing selected' }

  // Confirm the selected transactions exist before mutating.
  const owned = (
    await db.select({ id: transactions.id }).from(transactions).where(inArray(transactions.id, ids))
  ).map((r) => r.id)
  if (owned.length === 0) return { error: 'Nothing to update' }

  if (input.setCategoryId) {
    const ok = await db.query.categories.findFirst({
      where: eq(categories.id, input.setCategoryId),
      columns: { id: true },
    })
    if (!ok) return { error: 'Unknown category' }
  }

  await db.transaction(async (tx) => {
    const set: Partial<{ displayName: string | null; categoryId: string | null; updatedAt: Date }> =
      {}
    if (input.setDisplayName !== undefined) set.displayName = input.setDisplayName.trim() || null
    if (input.setCategoryId !== undefined) set.categoryId = input.setCategoryId
    if (Object.keys(set).length > 0) {
      set.updatedAt = new Date()
      await tx.update(transactions).set(set).where(inArray(transactions.id, owned))
    }

    if (input.addTagIds?.length) {
      const validTagIds = (
        await tx.select({ id: tags.id }).from(tags).where(inArray(tags.id, input.addTagIds))
      ).map((r) => r.id)
      const pairs = owned.flatMap((id) =>
        validTagIds.map((tagId) => ({ transactionId: id, tagId })),
      )
      // Chunk to stay under the bind-parameter limit on large selections.
      for (let i = 0; i < pairs.length; i += 1000) {
        await tx
          .insert(transactionTags)
          .values(pairs.slice(i, i + 1000))
          .onConflictDoNothing()
      }
    }
  })

  revalidatePath('/app/transactions')
  return { ok: true }
}
