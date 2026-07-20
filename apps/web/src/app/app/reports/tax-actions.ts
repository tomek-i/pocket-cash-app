'use server'

import { isAiEnabled, suggestTaxCandidates, type TaxItem } from '@repo/ai'
import {
  and,
  categories,
  db,
  eq,
  gte,
  inArray,
  lte,
  sql,
  tags,
  transactions,
  transactionTags,
} from '@repo/database'
import { revalidatePath } from 'next/cache'
import { formatMoney } from '@/lib/money'
import { getAiConfig, getDefaultCurrency } from '../settings/actions'
import { fyBounds } from './queries'

/** How many untagged FY transactions we ever send to the LLM in one run. */
const AI_ITEM_CAP = 300
const AI_BATCH_SIZE = 40

// ── Accountant-ready FY summary (no AI) ──────────────────────────────────────

export interface TaxSummaryRow {
  label: string
  total: number
  count: number
}

export interface FyTaxSummary {
  fy: number
  currency: string
  income: TaxSummaryRow[]
  expenses: TaxSummaryRow[]
  totalIncome: number
  totalExpenses: number
  /** Everything carrying the "tax" tag — the user's flagged deductions. */
  taxTagged: { total: number; count: number; byCategory: TaxSummaryRow[] } | null
}

/** Totals grouped by category for one FY, plus a focused view of "tax"-tagged items. */
export async function getFyTaxSummary(fy: number): Promise<FyTaxSummary> {
  const currency = await getDefaultCurrency()
  const bounds = fyBounds(fy)
  const inFy = and(
    gte(transactions.date, bounds.start),
    lte(transactions.date, bounds.endInclusive),
  )

  const rows = await db
    .select({
      name: categories.name,
      income: sql<string>`coalesce(sum(case when ${transactions.amount} > 0 then ${transactions.amount} else 0 end), 0)`,
      expense: sql<string>`coalesce(sum(case when ${transactions.amount} < 0 then -${transactions.amount} else 0 end), 0)`,
      incomeCount: sql<string>`sum(case when ${transactions.amount} > 0 then 1 else 0 end)`,
      expenseCount: sql<string>`sum(case when ${transactions.amount} < 0 then 1 else 0 end)`,
    })
    .from(transactions)
    .leftJoin(categories, eq(categories.id, transactions.categoryId))
    .where(inFy)
    .groupBy(categories.id, categories.name)

  const income: TaxSummaryRow[] = []
  const expenses: TaxSummaryRow[] = []
  for (const r of rows) {
    const label = r.name ?? 'Uncategorised'
    const inc = Number(r.income)
    const exp = Number(r.expense)
    if (inc > 0) income.push({ label, total: inc, count: Number(r.incomeCount) })
    if (exp > 0) expenses.push({ label, total: exp, count: Number(r.expenseCount) })
  }
  income.sort((a, b) => b.total - a.total)
  expenses.sort((a, b) => b.total - a.total)

  // Items carrying a tag literally named "tax" (case-insensitive) — expenses only.
  const taxRows = await db
    .select({
      name: categories.name,
      total: sql<string>`coalesce(sum(case when ${transactions.amount} < 0 then -${transactions.amount} else 0 end), 0)`,
      count: sql<string>`count(*)`,
    })
    .from(transactions)
    .innerJoin(transactionTags, eq(transactionTags.transactionId, transactions.id))
    .innerJoin(tags, and(eq(tags.id, transactionTags.tagId), sql`lower(${tags.name}) = 'tax'`))
    .leftJoin(categories, eq(categories.id, transactions.categoryId))
    .where(inFy)
    .groupBy(categories.id, categories.name)

  const byCategory: TaxSummaryRow[] = taxRows
    .map((r) => ({
      label: r.name ?? 'Uncategorised',
      total: Number(r.total),
      count: Number(r.count),
    }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.total - a.total)
  const taxTotal = byCategory.reduce((s, r) => s + r.total, 0)
  const taxCount = byCategory.reduce((s, r) => s + r.count, 0)

  return {
    fy,
    currency,
    income,
    expenses,
    totalIncome: income.reduce((s, r) => s + r.total, 0),
    totalExpenses: expenses.reduce((s, r) => s + r.total, 0),
    taxTagged: taxCount > 0 ? { total: taxTotal, count: taxCount, byCategory } : null,
  }
}

// ── AI candidate finder ──────────────────────────────────────────────────────

export interface TaxCandidateRow {
  transactionId: string
  date: string
  description: string
  amount: number
  currency: string
  category: string | null
  reason: string
  kind: string | null
  confidence: number
}

export interface FindTaxResult {
  candidates: TaxCandidateRow[]
  scanned: number
  truncated: boolean
}

export type FindTaxOutcome = FindTaxResult | { error: string }

/**
 * Ask the model which of this FY's untagged transactions look tax-relevant.
 * Already-"tax"-tagged rows are skipped. Nothing is written — the caller reviews
 * and applies the tag via `applyTaxTag`.
 */
export async function findTaxCandidates(fy: number): Promise<FindTaxOutcome> {
  const config = await getAiConfig()
  if (!isAiEnabled(config)) return { error: 'AI is turned off. Enable it in Settings.' }

  const bounds = fyBounds(fy)
  const inFy = and(
    gte(transactions.date, bounds.start),
    lte(transactions.date, bounds.endInclusive),
  )

  // Transaction ids that already carry the "tax" tag — excluded from the scan.
  const taggedRows = await db
    .select({ id: transactionTags.transactionId })
    .from(transactionTags)
    .innerJoin(tags, and(eq(tags.id, transactionTags.tagId), sql`lower(${tags.name}) = 'tax'`))
    .innerJoin(transactions, eq(transactions.id, transactionTags.transactionId))
    .where(inFy)
  const taggedIds = new Set(taggedRows.map((r) => r.id))

  const allRows = await db
    .select({
      id: transactions.id,
      date: transactions.date,
      description: transactions.description,
      displayName: transactions.displayName,
      amount: transactions.amount,
      currency: transactions.currency,
      category: categories.name,
    })
    .from(transactions)
    .leftJoin(categories, eq(categories.id, transactions.categoryId))
    .where(inFy)

  const rows = allRows.filter((r) => !taggedIds.has(r.id))
  const scanned = rows.length
  const truncated = rows.length > AI_ITEM_CAP
  const capped = rows.slice(0, AI_ITEM_CAP)
  if (capped.length === 0) return { candidates: [], scanned, truncated: false }

  const byId = new Map(capped.map((r) => [r.id, r]))
  const items: TaxItem[] = capped.map((r) => ({
    key: r.id,
    description: r.displayName ?? r.description,
    category: r.category,
    amount: formatMoney(Math.abs(r.amount), r.currency),
    direction: r.amount < 0 ? 'debit' : 'credit',
  }))

  const candidates: TaxCandidateRow[] = []
  try {
    for (let i = 0; i < items.length; i += AI_BATCH_SIZE) {
      const batch = items.slice(i, i + AI_BATCH_SIZE)
      const verdicts = await suggestTaxCandidates({ config, items: batch })
      for (const v of verdicts) {
        if (!v.taxRelevant) continue
        const r = byId.get(v.key)
        if (!r) continue
        candidates.push({
          transactionId: r.id,
          date: r.date,
          description: r.displayName ?? r.description,
          amount: r.amount,
          currency: r.currency,
          category: r.category,
          reason: v.reason,
          kind: v.kind,
          confidence: v.confidence,
        })
      }
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Tax scan failed' }
  }

  candidates.sort((a, b) => b.confidence - a.confidence)
  return { candidates, scanned, truncated }
}

// ── Apply the "tax" tag ──────────────────────────────────────────────────────

export type ApplyTaxResult = { ok: true; tagged: number } | { error: string }

/** Find-or-create the "tax" tag. */
async function ensureTaxTagId(): Promise<string> {
  const existing = await db
    .select({ id: tags.id })
    .from(tags)
    .where(sql`lower(${tags.name}) = 'tax'`)
    .limit(1)
  if (existing[0]) return existing[0].id
  const [created] = await db
    .insert(tags)
    .values({ name: 'tax', color: '#16a34a' })
    .returning({ id: tags.id })
  if (!created) throw new Error('Failed to create tax tag')
  return created.id
}

/** Add the "tax" tag to the given transactions (creating the tag if needed). */
export async function applyTaxTag(fy: number, transactionIds: string[]): Promise<ApplyTaxResult> {
  const ids = [...new Set(transactionIds)]
  if (ids.length === 0) return { error: 'Nothing selected' }

  const owned = (
    await db.select({ id: transactions.id }).from(transactions).where(inArray(transactions.id, ids))
  ).map((r) => r.id)
  if (owned.length === 0) return { error: 'Nothing to tag' }

  const tagId = await ensureTaxTagId()
  const pairs = owned.map((id) => ({ transactionId: id, tagId }))
  for (let i = 0; i < pairs.length; i += 1000) {
    await db
      .insert(transactionTags)
      .values(pairs.slice(i, i + 1000))
      .onConflictDoNothing()
  }

  revalidatePath(`/app/reports/${fy}`)
  revalidatePath('/app/transactions')
  return { ok: true, tagged: owned.length }
}
