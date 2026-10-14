import {
  accounts,
  and,
  asc,
  banks,
  categories,
  db,
  eq,
  financialSubscriptions,
  gte,
  lt,
  sql,
  transactionListOrder,
  transactions,
} from '@repo/database'
import type { BillingCycle } from '@repo/types'
import { getDefaultCurrency } from '../settings/actions'
import { byPaymentStatus, monthlyCost, type PaymentStatus } from '../subscriptions/_lib/schedule'
import { loadPaymentStatuses } from '../subscriptions/_lib/status'
import { incomeSum, notTransfer, spendingSum, transferNetSum } from '../transactions/_lib/flows'

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
  /**
   * Signed net of the month's transfers. Linked pairs cancel out, so this is
   * money moved to or from accounts the app does not track.
   */
  transfersNet: number
  /** Whether any transaction is dated in the selected month. */
  monthHasData: boolean
  /**
   * The newest month holding any transaction, or null with none at all.
   * `selectable` is false when it is older than the picker's 12 months.
   */
  latestMonth: { key: string; label: string; selectable: boolean } | null
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
    status: PaymentStatus
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
        income: incomeSum,
        spending: spendingSum,
        transfers: transferNetSum,
        count: sql<string>`count(*)`,
      })
      .from(transactions)
      .where(and(gte(transactions.date, from), lt(transactions.date, to)))
    return {
      income: Number(row?.income ?? 0),
      spending: Number(row?.spending ?? 0),
      transfers: Number(row?.transfers ?? 0),
      count: Number(row?.count ?? 0),
    }
  }
  const thisMonth = await flows(startThisMonth, startNextMonth)
  const lastMonth = await flows(startLastMonth, startThisMonth)
  const pctChange = (curr: number, prev: number): number | null =>
    prev > 0 ? ((curr - prev) / prev) * 100 : null

  // The newest month with anything in it, so an empty month can point somewhere.
  const [latestRow] = await db
    .select({ date: sql<string | null>`max(${transactions.date})` })
    .from(transactions)
  const latestKey = latestRow?.date?.slice(0, 7)
  const latestMonth = latestKey
    ? {
        key: latestKey,
        label: new Date(`${latestKey}-01T00:00:00Z`).toLocaleDateString('en-US', {
          month: 'long',
          year: 'numeric',
          timeZone: 'UTC',
        }),
        selectable: trendKeys.includes(latestKey),
      }
    : null

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
        notTransfer,
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
    orderBy: transactionListOrder,
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
      matcher: financialSubscriptions.matcher,
    })
    .from(financialSubscriptions)
    .where(eq(financialSubscriptions.active, true))
    .orderBy(asc(financialSubscriptions.name))
  const subStatuses = await loadPaymentStatuses(subRows)
  const upcomingSubs = subRows
    .map(({ nextPaymentDate: _stored, matcher: _matcher, ...sub }) => ({
      ...sub,
      status: subStatuses.get(sub.id) ?? { kind: 'unknown' as const },
    }))
    .sort((a, b) => byPaymentStatus(a.status, b.status))

  const subsMonthlyTotal = subRows.reduce((sum, s) => sum + monthlyCost(s.amount, s.cycle), 0)

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
    transfersNet: thisMonth.transfers,
    monthHasData: thisMonth.count > 0,
    latestMonth,
    incomeChangePct: pctChange(thisMonth.income, lastMonth.income),
    spendingChangePct: pctChange(thisMonth.spending, lastMonth.spending),
    recent,
    subscriptions: upcomingSubs.slice(0, 6),
    subsMonthlyTotal,
  }
}
