import {
  accounts,
  banks,
  branches,
  categories,
  count,
  csvImports,
  csvMappings,
  db,
  financialSubscriptions,
  tags,
  transactions,
  transactionTags,
} from '@repo/database'
import { buildDemoData } from './demo-data'

/** The transaction handle Drizzle passes to `db.transaction(async (tx) => …)`. */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

/**
 * True when the workspace has no finance data yet. Used to decide whether the
 * first-run welcome tour should show — an install that predates the onboarding
 * flag but already has banks/transactions is treated as already set up.
 */
export async function isWorkspaceEmpty(): Promise<boolean> {
  const [bankRow] = await db.select({ n: count() }).from(banks)
  const [txnRow] = await db.select({ n: count() }).from(transactions)
  return (bankRow?.n ?? 0) === 0 && (txnRow?.n ?? 0) === 0
}

/**
 * Delete every piece of finance data (children first so foreign keys never
 * block). Settings are left untouched. Shared by the settings "Reset all data"
 * action, the backup restore, and the demo re-seed so the wipe order lives in one
 * place. Returns the number of transactions removed.
 */
export async function wipeAllFinanceData(tx: Tx): Promise<number> {
  const removed = await tx.delete(transactions).returning({ id: transactions.id })
  await tx.delete(csvImports)
  await tx.delete(financialSubscriptions)
  await tx.delete(accounts)
  await tx.delete(branches)
  await tx.delete(csvMappings)
  await tx.delete(banks)
  await tx.delete(categories)
  await tx.delete(tags)
  return removed.length
}

/** now + `days`, as a YYYY-MM-DD string for a `date` column. */
function ymdPlusDays(now: Date, days: number): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

/**
 * Insert the full demo dataset (bank, accounts, categories, tags, subscriptions
 * and several months of transactions) within an existing transaction. Assumes the
 * finance tables are empty — call {@link wipeAllFinanceData} first if re-seeding.
 * Returns the number of transactions inserted.
 */
export async function seedDemoData(tx: Tx, now: Date): Promise<number> {
  const data = buildDemoData(now)

  // Bank.
  const [bank] = await tx.insert(banks).values(data.bank).returning({ id: banks.id })
  const bankId = bank?.id as string

  // Categories → name→id map.
  const insertedCategories = await tx
    .insert(categories)
    .values(data.categories.map((c) => ({ name: c.name, icon: c.icon, color: c.color })))
    .returning({ id: categories.id, name: categories.name })
  const categoryId = new Map(insertedCategories.map((c) => [c.name, c.id]))

  // Tags → name→id map.
  const insertedTags = await tx
    .insert(tags)
    .values(data.tags.map((t) => ({ name: t.name, color: t.color })))
    .returning({ id: tags.id, name: tags.name })
  const tagId = new Map(insertedTags.map((t) => [t.name, t.id]))

  // Accounts → key→id map (resolved via the def's name).
  const insertedAccounts = await tx
    .insert(accounts)
    .values(
      data.accounts.map((a) => ({
        bankId,
        name: a.name,
        type: a.type,
        currency: a.currency,
        openingBalance: a.openingBalance,
      })),
    )
    .returning({ id: accounts.id, name: accounts.name })
  const accountIdByName = new Map(insertedAccounts.map((a) => [a.name, a.id]))
  const accountId = new Map(
    data.accounts.map((a) => [a.key, accountIdByName.get(a.name) as string]),
  )

  // Subscriptions.
  if (data.subscriptions.length > 0) {
    await tx.insert(financialSubscriptions).values(
      data.subscriptions.map((s) => ({
        name: s.name,
        amount: s.amount,
        currency: 'USD',
        cycle: s.cycle,
        categoryId: categoryId.get(s.categoryName) ?? null,
        matcher: s.matcher,
        nextPaymentDate: ymdPlusDays(now, s.nextPaymentInDays),
      })),
    )
  }

  // Transactions. `fingerprint` is a unique-per-account synthetic key; we index
  // rows by it to attach tags after insertion (RETURNING order isn't guaranteed).
  const txnRows = data.transactions.map((t, i) => {
    const fingerprint = `demo-${i}`
    return {
      row: {
        accountId: accountId.get(t.accountKey) as string,
        date: t.date,
        description: t.description,
        merchant: t.merchant ?? null,
        amount: t.amount,
        currency: t.currency,
        categoryId: categoryId.get(t.categoryName) ?? null,
        fingerprint,
        rawData: {
          date: t.date,
          description: t.description,
          merchant: t.merchant ?? '',
          amount: (t.amount / 100).toFixed(2),
        } as Record<string, string>,
      },
      tagNames: t.tagNames ?? [],
      fingerprint,
    }
  })

  if (txnRows.length === 0) return 0

  const insertedTxns = await tx
    .insert(transactions)
    .values(txnRows.map((t) => t.row))
    .returning({ id: transactions.id, fingerprint: transactions.fingerprint })
  const txnIdByFingerprint = new Map(insertedTxns.map((t) => [t.fingerprint, t.id]))

  // Tag links.
  const tagLinks = txnRows.flatMap((t) => {
    const transactionId = txnIdByFingerprint.get(t.fingerprint)
    if (!transactionId) return []
    return t.tagNames
      .map((name) => tagId.get(name))
      .filter((id): id is string => Boolean(id))
      .map((tid) => ({ transactionId, tagId: tid }))
  })
  if (tagLinks.length > 0) {
    await tx.insert(transactionTags).values(tagLinks)
  }

  return insertedTxns.length
}
