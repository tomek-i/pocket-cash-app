import {
  accounts,
  and,
  asc,
  banks,
  categories,
  db,
  desc,
  eq,
  financialSubscriptions,
  gte,
  lt,
  sql,
  transactions,
} from '@repo/database'
import { BILLING_CYCLE_DAYS, type BillingCycle } from '@repo/types'
import { getDefaultCurrency } from '../settings/actions'

/**
 * All figures on the Overview dashboard, computed from the workspace's real data.
 * Amounts are integer minor units in the workspace's display currency. Multi-
 * currency workspaces are summed naively (a single-currency assumption).
 */
export interface DashboardData {
  currency: string
  /** The month the flow widgets (category spend, income, spending) are scoped to. */
  monthKey: string
  /** e.g. "June 2026" — the selected month, long form. */
  monthLabel: string
  /** e.g. "Jun" — the selected month, short form. */
  monthShort: string
  accounts: { id: string; name: string; bankName: string | null; balance: number }[]
  netWorth: number
  netWorthChangePct: number | null
  trend: number[]
  /** Index into `trend` (last 12 months) to highlight — the selected month. */
  trendHighlightIndex: number
  categorySpend: { label: string; value: number; color: string }[]
  monthSpendTotal: number
  income: number
  spending: number
  incomeChangePct: number | null
  spendingChangePct: number | null
  recent: {
    id: string
    name: string
    accountName: string
    category: { name: string; color: string | null; icon: string | null } | null
    amount: number
    currency: string
    date: string
  }[]
  subscriptions: {
    id: string
    name: string
    amount: number
    currency: string
    cycle: BillingCycle
    nextPaymentDate: string | null
  }[]
  subsMonthlyTotal: number
}

const CHART_PALETTE = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
  'var(--color-chart-4)',
  'var(--color-chart-5)',
]
const HEX = /^#[0-9a-fA-F]{6}$/

function ymd(year: number, monthIndex0: number): string {
  const d = new Date(Date.UTC(year, monthIndex0, 1))
  return d.toISOString().slice(0, 10)
}

function lastMonthKeys(n: number): string[] {
  const now = new Date()
  const keys: string[] = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
    keys.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`)
  }
  return keys
}

/**
 * @param monthKey Optional `YYYY-MM` to scope the flow widgets (category spend,
 *   income, spending) to a past month from the picker. Defaults to the current
 *   month; an unknown key falls back to it. Net worth, accounts, recent activity
 *   and subscriptions are always "now" — only the monthly figures move.
 */
export async function getDashboardData(monthKey?: string): Promise<DashboardData> {
  const currency = await getDefaultCurrency()

  // Resolve the selected month against the same 12-month window the trend uses, so
  // the picker's keys line up with a trend index. Unknown/absent → current month.
  const trendKeys = lastMonthKeys(12)
  const selectedKey = monthKey && trendKeys.includes(monthKey) ? monthKey : trendKeys[11]
  const [selYearStr, selMonthStr] = (selectedKey as string).split('-')
  const selYear = Number(selYearStr)
  const selMonth0 = Number(selMonthStr) - 1
  const startThisMonth = ymd(selYear, selMonth0)
  const startLastMonth = ymd(selYear, selMonth0 - 1)
  const startNextMonth = ymd(selYear, selMonth0 + 1)
  const selDate = new Date(Date.UTC(selYear, selMonth0, 1))
  const monthLabel = selDate.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
  const monthShort = selDate.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })

  // ── Accounts + balances (opening balance + net of transactions) ──────────────
  const accountRows = await db
    .select({
      id: accounts.id,
      name: accounts.name,
      bankName: banks.name,
      opening: accounts.openingBalance,
      txnSum: sql<string>`coalesce(sum(${transactions.amount}), 0)`,
    })
    .from(accounts)
    .leftJoin(banks, eq(banks.id, accounts.bankId))
    .leftJoin(transactions, eq(transactions.accountId, accounts.id))
    .groupBy(accounts.id, banks.name)
    .orderBy(asc(accounts.name))

  const accountBalances = accountRows.map((a) => ({
    id: a.id,
    name: a.name,
    bankName: a.bankName,
    balance: (a.opening ?? 0) + Number(a.txnSum),
  }))
  const netWorth = accountBalances.reduce((sum, a) => sum + a.balance, 0)
  const openingBase = accountRows.reduce((sum, a) => sum + (a.opening ?? 0), 0)

  // ── Monthly income / spending (this month + last month for the delta) ────────
  const flows = async (from: string, to: string) => {
    const [row] = await db
      .select({
        income: sql<string>`coalesce(sum(case when ${transactions.amount} > 0 then ${transactions.amount} else 0 end), 0)`,
        spending: sql<string>`coalesce(sum(case when ${transactions.amount} < 0 then -${transactions.amount} else 0 end), 0)`,
      })
      .from(transactions)
      .where(and(gte(transactions.date, from), lt(transactions.date, to)))
    return { income: Number(row?.income ?? 0), spending: Number(row?.spending ?? 0) }
  }
  const thisMonth = await flows(startThisMonth, startNextMonth)
  const lastMonth = await flows(startLastMonth, startThisMonth)
  const pctChange = (curr: number, prev: number): number | null =>
    prev > 0 ? ((curr - prev) / prev) * 100 : null

  // ── Spending by category (this month, debits only) ───────────────────────────
  const catRows = await db
    .select({
      name: categories.name,
      color: categories.color,
      spend: sql<string>`coalesce(sum(-${transactions.amount}), 0)`,
    })
    .from(transactions)
    .leftJoin(categories, eq(categories.id, transactions.categoryId))
    .where(
      and(
        lt(transactions.amount, 0),
        gte(transactions.date, startThisMonth),
        lt(transactions.date, startNextMonth),
      ),
    )
    .groupBy(categories.id, categories.name, categories.color)

  const cats = catRows
    .map((c) => ({ name: c.name ?? 'Uncategorised', color: c.color, spend: Number(c.spend) }))
    .filter((c) => c.spend > 0)
    .sort((a, b) => b.spend - a.spend)
  const monthSpendTotal = cats.reduce((sum, c) => sum + c.spend, 0)
  const topCats = cats.slice(0, 5)
  const rest = cats.slice(5)
  const categorySpend = topCats.map((c, i) => ({
    label: c.name,
    value: c.spend,
    color:
      c.color && HEX.test(c.color)
        ? c.color
        : (CHART_PALETTE[i % CHART_PALETTE.length] ?? 'var(--color-chart-1)'),
  }))
  if (rest.length > 0) {
    categorySpend.push({
      label: `Other (${rest.length})`,
      value: rest.reduce((sum, c) => sum + c.spend, 0),
      color: 'var(--color-muted-foreground)',
    })
  }

  // ── Net-worth trend over the last 12 months ──────────────────────────────────
  const monthlyRows = await db
    .select({
      month: sql<string>`to_char(date_trunc('month', ${transactions.date}::date), 'YYYY-MM')`,
      net: sql<string>`coalesce(sum(${transactions.amount}), 0)`,
    })
    .from(transactions)
    .groupBy(sql`date_trunc('month', ${transactions.date}::date)`)
  const months = monthlyRows.map((r) => ({ key: r.month, net: Number(r.net) }))
  const trend = lastMonthKeys(12).map(
    (key) => openingBase + months.filter((m) => m.key <= key).reduce((s, m) => s + m.net, 0),
  )
  const lastNet = trend.at(-1)
  const prevNet = trend.at(-2)
  const netWorthChangePct =
    lastNet !== undefined && prevNet !== undefined ? pctChange(lastNet, prevNet) : null

  // ── Recent activity ──────────────────────────────────────────────────────────
  const recentRows = await db.query.transactions.findMany({
    orderBy: [desc(transactions.date), desc(transactions.createdAt)],
    limit: 6,
    columns: {
      id: true,
      date: true,
      displayName: true,
      description: true,
      amount: true,
      currency: true,
    },
    with: {
      account: { columns: { name: true } },
      category: { columns: { name: true, color: true, icon: true } },
    },
  })
  const recent = recentRows.map((t) => ({
    id: t.id,
    name: t.displayName ?? t.description,
    accountName: t.account.name,
    category: t.category,
    amount: t.amount,
    currency: t.currency,
    date: t.date,
  }))

  // ── Upcoming subscriptions ───────────────────────────────────────────────────
  const subRows = await db
    .select({
      id: financialSubscriptions.id,
      name: financialSubscriptions.name,
      amount: financialSubscriptions.amount,
      currency: financialSubscriptions.currency,
      cycle: financialSubscriptions.cycle,
      nextPaymentDate: financialSubscriptions.nextPaymentDate,
    })
    .from(financialSubscriptions)
    .where(eq(financialSubscriptions.active, true))
    .orderBy(asc(financialSubscriptions.nextPaymentDate))

  const subsMonthlyTotal = subRows.reduce(
    (sum, s) => sum + Math.round(s.amount * (30 / BILLING_CYCLE_DAYS[s.cycle])),
    0,
  )

  return {
    currency,
    monthKey: selectedKey as string,
    monthLabel,
    monthShort,
    accounts: accountBalances,
    netWorth,
    netWorthChangePct,
    trend,
    trendHighlightIndex: trendKeys.indexOf(selectedKey as string),
    categorySpend,
    monthSpendTotal,
    income: thisMonth.income,
    spending: thisMonth.spending,
    incomeChangePct: pctChange(thisMonth.income, lastMonth.income),
    spendingChangePct: pctChange(thisMonth.spending, lastMonth.spending),
    recent,
    subscriptions: subRows.slice(0, 6),
    subsMonthlyTotal,
  }
}
