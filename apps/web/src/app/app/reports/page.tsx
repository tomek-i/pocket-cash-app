import { Card, CardContent, cn } from '@repo/ui'
import { BarChart3, ChevronRight, Upload } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { formatMoney } from '@/lib/money'
import { DonutChart } from '../_components/charts'
import { Empty } from '../_components/empty'
import { getDefaultCurrency } from '../settings/actions'
import {
  currentFy,
  type FyBreakdown,
  type FySummary,
  fyRangeLabel,
  getFyCategoryBreakdowns,
  listFinancialYears,
} from './queries'

export const metadata = { title: 'Reports' }

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>
}) {
  const { view } = await searchParams
  const showingPast = view === 'past'

  const [years, breakdowns, currency] = await Promise.all([
    listFinancialYears(),
    getFyCategoryBreakdowns(),
    getDefaultCurrency(),
  ])

  const cy = currentFy()
  const currentSummary: FySummary = years.find((y) => y.fy === cy) ?? {
    fy: cy,
    income: 0,
    spending: 0,
    net: 0,
    count: 0,
  }
  const pastYears = years.filter((y) => y.fy !== cy).sort((a, b) => b.fy - a.fy)

  return (
    <div className="flex flex-col gap-6 px-5 py-5 lg:px-8 lg:py-7">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">Reports</h1>
        <p className="text-muted-foreground text-sm">
          Transactions by Australian financial year (1 Jul – 30 Jun).
        </p>
      </div>

      <div className="flex w-fit gap-1 rounded-lg bg-muted p-1">
        <TabLink href="/app/reports" active={!showingPast}>
          Current · FY{cy}
        </TabLink>
        <TabLink href="/app/reports?view=past" active={showingPast}>
          Previous years{pastYears.length ? ` (${pastYears.length})` : ''}
        </TabLink>
      </div>

      {showingPast ? (
        pastYears.length === 0 ? (
          <Card>
            <Empty
              className="p-12"
              icon={BarChart3}
              title="No previous years"
              description="Once you import transactions from earlier financial years they'll appear here."
            />
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {pastYears.map((y) => (
              <FyCard key={y.fy} y={y} breakdown={breakdowns.get(y.fy)} currency={currency} />
            ))}
          </div>
        )
      ) : currentSummary.count === 0 ? (
        <Card>
          <Empty
            className="p-12"
            icon={BarChart3}
            title={`No transactions for FY${cy} yet`}
            description={`${fyRangeLabel(cy)}. Import a statement to start this year's report${pastYears.length ? ', or check previous years' : ''}.`}
            action={
              <Link
                href="/app/import"
                className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 font-medium text-primary-foreground text-sm hover:bg-primary/80"
              >
                <Upload className="size-4" />
                Import CSV
              </Link>
            }
          />
        </Card>
      ) : (
        <FyCard y={currentSummary} breakdown={breakdowns.get(cy)} currency={currency} />
      )}
    </div>
  )
}

function TabLink({
  href,
  active,
  children,
}: {
  href: string
  active: boolean
  children: ReactNode
}) {
  return (
    <Link
      href={href}
      className={cn(
        'rounded-md px-3 py-1.5 font-medium text-sm transition-colors',
        active
          ? 'bg-card text-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </Link>
  )
}

function FyCard({
  y,
  breakdown,
  currency,
}: {
  y: FySummary
  breakdown: FyBreakdown | undefined
  currency: string
}) {
  return (
    <Link href={`/app/reports/${y.fy}`}>
      <Card className="transition-colors hover:bg-muted/40">
        <CardContent className="flex flex-col gap-4 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-lg">FY{y.fy}</p>
              <p className="text-muted-foreground text-xs">{fyRangeLabel(y.fy)}</p>
            </div>
            <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
          </div>
          <div className="flex items-center gap-4">
            {breakdown && breakdown.total > 0 ? (
              <DonutChart data={breakdown.slices} className="size-24 shrink-0" />
            ) : null}
            <div className="flex flex-1 flex-col gap-2">
              <StatRow
                label="Income"
                value={formatMoney(y.income, currency)}
                className="text-success"
              />
              <StatRow
                label="Spending"
                value={formatMoney(y.spending, currency)}
                className="text-destructive"
              />
              <StatRow
                label="Net"
                value={formatMoney(y.net, currency)}
                className={y.net >= 0 ? 'text-success' : 'text-destructive'}
              />
            </div>
          </div>
          <p className="text-muted-foreground text-xs">
            {y.count} transaction{y.count === 1 ? '' : 's'}
          </p>
        </CardContent>
      </Card>
    </Link>
  )
}

function StatRow({
  label,
  value,
  className,
}: {
  label: string
  value: string
  className?: string
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn('font-medium tabular-nums', className)}>{value}</span>
    </div>
  )
}
