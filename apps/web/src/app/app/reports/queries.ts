import { categories, db, eq, lt, sql, transactions } from '@repo/database'

/** Australian financial year starts in July. A FY is named by its ending year:
 * FY2025 = 1 Jul 2024 – 30 Jun 2025. */
const FY_START_MONTH = 7

export function fyForDate(d: Date): number {
  return d.getUTCFullYear() + (d.getUTCMonth() + 1 >= FY_START_MONTH ? 1 : 0)
}

export function currentFy(): number {
  return fyForDate(new Date())
}

export function fyBounds(fy: number): { start: string; endInclusive: string } {
  return { start: `${fy - 1}-07-01`, endInclusive: `${fy}-06-30` }
}

export function fyLabel(fy: number): string {
  return `FY${fy}`
}

export function fyRangeLabel(fy: number): string {
  return `1 Jul ${fy - 1} – 30 Jun ${fy}`
}

export interface FySummary {
  fy: number
  income: number
  spending: number
  net: number
  count: number
}

/**
 * Income / spending / net / count grouped by AU financial year, newest first.
 * Aggregated by month in SQL (a reliable date_trunc group key) then bucketed into
 * FYs in JS — Postgres rejects grouping by the compound FY expression directly.
 */
export async function listFinancialYears(): Promise<FySummary[]> {
  const rows = await db
    .select({
      month: sql<string>`to_char(date_trunc('month', ${transactions.date}::date), 'YYYY-MM')`,
      income: sql<string>`coalesce(sum(case when ${transactions.amount} > 0 then ${transactions.amount} else 0 end), 0)`,
      spending: sql<string>`coalesce(sum(case when ${transactions.amount} < 0 then -${transactions.amount} else 0 end), 0)`,
      count: sql<string>`count(*)`,
    })
    .from(transactions)
    .groupBy(sql`date_trunc('month', ${transactions.date}::date)`)

  const byFy = new Map<number, FySummary>()
  for (const r of rows) {
    const [yearStr, monthStr] = r.month.split('-')
    const fy = Number(yearStr) + (Number(monthStr) >= FY_START_MONTH ? 1 : 0)
    const cur = byFy.get(fy) ?? { fy, income: 0, spending: 0, net: 0, count: 0 }
    cur.income += Number(r.income)
    cur.spending += Number(r.spending)
    cur.count += Number(r.count)
    cur.net = cur.income - cur.spending
    byFy.set(fy, cur)
  }
  return [...byFy.values()].sort((a, b) => b.fy - a.fy)
}

// ── Category breakdown per FY (for the pie charts) ───────────────────────────

export interface CategorySlice {
  label: string
  value: number
  color: string
}
export interface FyBreakdown {
  slices: CategorySlice[]
  total: number
}

const CHART_PALETTE = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
  'var(--color-chart-4)',
  'var(--color-chart-5)',
]
const HEX = /^#[0-9a-fA-F]{6}$/

/** Spending-by-category slices (top 5 + Other) per FY — keyed by FY ending year. */
export async function getFyCategoryBreakdowns(): Promise<Map<number, FyBreakdown>> {
  const rows = await db
    .select({
      month: sql<string>`to_char(date_trunc('month', ${transactions.date}::date), 'YYYY-MM')`,
      name: categories.name,
      color: categories.color,
      spend: sql<string>`coalesce(sum(-${transactions.amount}), 0)`,
    })
    .from(transactions)
    .leftJoin(categories, eq(categories.id, transactions.categoryId))
    .where(lt(transactions.amount, 0))
    .groupBy(
      sql`date_trunc('month', ${transactions.date}::date)`,
      categories.id,
      categories.name,
      categories.color,
    )

  // (fy → (categoryLabel → { spend, color }))
  const perFy = new Map<number, Map<string, { spend: number; color: string | null }>>()
  for (const r of rows) {
    const [yearStr, monthStr] = r.month.split('-')
    const fy = Number(yearStr) + (Number(monthStr) >= FY_START_MONTH ? 1 : 0)
    const label = r.name ?? 'Uncategorised'
    const cats = perFy.get(fy) ?? new Map()
    const cur = cats.get(label) ?? { spend: 0, color: r.color }
    cur.spend += Number(r.spend)
    cats.set(label, cur)
    perFy.set(fy, cats)
  }

  const result = new Map<number, FyBreakdown>()
  for (const [fy, cats] of perFy) {
    const sorted = [...cats.entries()]
      .map(([label, v]) => ({ label, spend: v.spend, color: v.color }))
      .filter((c) => c.spend > 0)
      .sort((a, b) => b.spend - a.spend)
    const total = sorted.reduce((s, c) => s + c.spend, 0)
    const slices: CategorySlice[] = sorted.slice(0, 5).map((c, i) => ({
      label: c.label,
      value: c.spend,
      color: c.color && HEX.test(c.color) ? c.color : (CHART_PALETTE[i] ?? 'var(--color-chart-1)'),
    }))
    const rest = sorted.slice(5)
    if (rest.length > 0) {
      slices.push({
        label: `Other (${rest.length})`,
        value: rest.reduce((s, c) => s + c.spend, 0),
        color: 'var(--color-muted-foreground)',
      })
    }
    result.set(fy, { slices, total })
  }
  return result
}
