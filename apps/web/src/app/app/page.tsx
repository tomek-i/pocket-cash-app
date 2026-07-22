import {
  Avatar,
  AvatarFallback,
  Badge,
  buttonVariants,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  cn,
} from '@repo/ui'
import {
  ArrowDownRight,
  ArrowLeftRight,
  ArrowUpRight,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import Link from 'next/link'
import { amountClassName, formatMoney } from '@/lib/money'
import { prepareEmbeddedDatabase } from '@/lib/workspace'
import { DonutChart, MiniBars } from './_components/charts'
import { Empty } from './_components/empty'
import { InsightCard } from './_components/insight-card'
import { OverviewTopbar } from './_components/overview-topbar'
import { getDashboardData } from './_lib/dashboard'
import { generateDashboardInsight, getDashboardInsight } from './_lib/dashboard-insight-actions'
import { CategoryIcon } from './categories/_components/category-icon'
import { isAiConfigured } from './settings/actions'
import { CYCLE_LABELS } from './subscriptions/_components/subscription-dialog'

export const metadata = { title: 'Overview' }

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return (parts.map((p) => p[0]).join('') || '?').slice(0, 2).toUpperCase()
}

function pct(value: number | null): string {
  if (value === null) return ''
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
}

function shortDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default async function OverviewPage() {
  // RSC renders this page concurrently with the layout, so the layout's DB-prep
  // await does NOT gate our queries below. On a cold process the embedded DB may
  // still be opening/migrating; await readiness here (memoised process-wide, so
  // this is a no-op once warm) before touching it. This is the desktop's landing
  // route, so it's the one cold start that would otherwise race.
  await prepareEmbeddedDatabase()
  const [data, aiConfigured, insight] = await Promise.all([
    getDashboardData(),
    isAiConfigured(),
    getDashboardInsight(),
  ])
  const { currency } = data

  const today = new Date()
  const dateLabel = today.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
  const monthLabel = today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  return (
    <div className="flex flex-col gap-6 px-5 py-5 lg:px-8 lg:py-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-semibold text-2xl tracking-tight">Overview</h1>
          <p className="text-muted-foreground text-sm">{dateLabel} · everything in one place.</p>
        </div>
        <OverviewTopbar />
      </div>

      {/* Top row */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        {/* Net worth */}
        <Card className="xl:col-span-5">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="font-medium text-muted-foreground text-sm">
              Total net worth · {data.accounts.length} account
              {data.accounts.length === 1 ? '' : 's'}
            </CardTitle>
            {data.netWorthChangePct !== null ? (
              <Badge variant={data.netWorthChangePct >= 0 ? 'success' : 'destructive'}>
                {data.netWorthChangePct >= 0 ? (
                  <TrendingUp className="size-3" />
                ) : (
                  <TrendingDown className="size-3" />
                )}
                {pct(data.netWorthChangePct)}
              </Badge>
            ) : null}
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="flex items-end justify-between gap-4">
              <span className="font-semibold text-4xl tracking-tight tabular-nums">
                {formatMoney(data.netWorth, currency)}
              </span>
              {data.trend.some((v) => v !== 0) ? (
                <MiniBars
                  values={data.trend}
                  highlightIndex={data.trend.length - 1}
                  className="w-32"
                />
              ) : null}
            </div>
            {data.accounts.length === 0 ? (
              <p className="rounded-lg border border-dashed p-4 text-center text-muted-foreground text-sm">
                No accounts yet.{' '}
                <Link href="/app/accounts" className="text-primary hover:underline">
                  Add one
                </Link>
                .
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {data.accounts.map((acct) => (
                  <div
                    key={acct.id}
                    className="flex items-center gap-3 rounded-lg border bg-background/40 p-3"
                  >
                    <Avatar className="size-8 rounded-md">
                      <AvatarFallback className="rounded-md bg-primary/15 text-[11px] text-primary">
                        {initials(acct.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-muted-foreground text-xs">
                        {acct.bankName ? `${acct.bankName} · ` : ''}
                        {acct.name}
                      </p>
                      <p
                        className={cn(
                          'font-medium text-sm tabular-nums',
                          amountClassName(acct.balance),
                        )}
                      >
                        {formatMoney(acct.balance, currency)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Spending by category */}
        <Card className="xl:col-span-4">
          <CardHeader>
            <CardTitle className="font-medium text-muted-foreground text-sm">
              Spending by category
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-5">
            {data.categorySpend.length === 0 ? (
              <p className="py-6 text-muted-foreground text-sm">No spending this month.</p>
            ) : (
              <>
                <DonutChart
                  data={data.categorySpend}
                  centerValue={formatMoney(data.monthSpendTotal, currency)}
                  centerLabel={monthLabel}
                  className="shrink-0"
                />
                <ul className="flex w-full flex-col gap-2.5">
                  {data.categorySpend.map((slice) => (
                    <li key={slice.label} className="flex items-center gap-2 text-sm">
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: slice.color }}
                      />
                      <span className="flex-1 truncate text-muted-foreground">{slice.label}</span>
                      <span className="font-medium tabular-nums">
                        {formatMoney(slice.value, currency)}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </CardContent>
        </Card>

        {/* Income / Spending */}
        <div className="flex flex-col gap-4 xl:col-span-3">
          <StatCard
            label={`Income · ${today.toLocaleDateString('en-US', { month: 'short' })}`}
            value={formatMoney(data.income, currency)}
            delta={
              data.incomeChangePct !== null
                ? `${pct(data.incomeChangePct)} vs last month`
                : 'No prior month'
            }
            positive={(data.incomeChangePct ?? 0) >= 0}
          />
          <StatCard
            label={`Spending · ${today.toLocaleDateString('en-US', { month: 'short' })}`}
            value={formatMoney(data.spending, currency)}
            delta={
              data.spendingChangePct !== null
                ? `${pct(data.spendingChangePct)} vs last month`
                : 'No prior month'
            }
            positive={(data.spendingChangePct ?? 0) <= 0}
          />
        </div>
      </div>

      {/* AI summary */}
      {data.recent.length > 0 ? (
        <InsightCard
          aiConfigured={aiConfigured}
          initial={insight}
          generate={generateDashboardInsight}
          prompt={`How's ${monthLabel} going? Get a quick read on your income, spending and where the money's going.`}
        />
      ) : null}

      {/* Bottom row */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        {/* Recent activity */}
        <Card className="xl:col-span-7">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Recent activity</CardTitle>
            <Link
              href="/app/transactions"
              className="text-muted-foreground text-sm hover:text-foreground"
            >
              View all
            </Link>
          </CardHeader>
          <CardContent className="flex flex-col">
            {data.recent.length === 0 ? (
              <p className="py-6 text-muted-foreground text-sm">No transactions yet.</p>
            ) : (
              data.recent.map((txn, i) => (
                <Link
                  key={txn.id}
                  href={`/app/transactions/${txn.id}`}
                  className={cn(
                    'flex items-center gap-3 py-3 hover:bg-muted/30',
                    i !== data.recent.length - 1 && 'border-b',
                  )}
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    {txn.category ? (
                      <CategoryIcon
                        name={txn.category.icon}
                        color={txn.category.color}
                        className="size-[18px]"
                      />
                    ) : (
                      <ArrowLeftRight className="size-[18px]" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-sm">{txn.name}</p>
                    <p className="truncate text-muted-foreground text-xs">
                      {txn.accountName}
                      {txn.category ? ` · ${txn.category.name}` : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={cn(
                        'font-medium text-sm tabular-nums',
                        amountClassName(txn.amount),
                      )}
                    >
                      {formatMoney(txn.amount, txn.currency)}
                    </p>
                    <p className="text-muted-foreground text-xs">{shortDate(txn.date)}</p>
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        {/* Upcoming subscriptions */}
        <Card className="xl:col-span-5">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Upcoming subscriptions</CardTitle>
            {data.subsMonthlyTotal > 0 ? (
              <Badge variant="secondary" className="tabular-nums">
                {formatMoney(data.subsMonthlyTotal, currency)}/mo
              </Badge>
            ) : null}
          </CardHeader>
          <CardContent className="flex flex-col">
            {data.subscriptions.length === 0 ? (
              <Empty
                className="py-8"
                icon={RefreshCw}
                title="No subscriptions"
                description="Track recurring bills like Netflix or rent."
                action={
                  <Link href="/app/subscriptions" className={buttonVariants({ size: 'sm' })}>
                    Add subscription
                  </Link>
                }
              />
            ) : (
              data.subscriptions.map((sub, i) => (
                <div
                  key={sub.id}
                  className={cn(
                    'flex items-center gap-3 py-3',
                    i !== data.subscriptions.length - 1 && 'border-b',
                  )}
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                    <RefreshCw className="size-[18px]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-sm">{sub.name}</p>
                    <p className="truncate text-muted-foreground text-xs">
                      {CYCLE_LABELS[sub.cycle]}
                      {sub.nextPaymentDate ? ` · next ${shortDate(sub.nextPaymentDate)}` : ''}
                    </p>
                  </div>
                  <p className="font-medium text-sm tabular-nums">
                    {formatMoney(sub.amount, sub.currency)}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  delta,
  positive,
}: {
  label: string
  value: string
  delta: string
  positive?: boolean
}) {
  return (
    <Card className="flex-1">
      <CardContent className="flex h-full flex-col justify-between gap-6 p-5">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-sm">{label}</span>
          {positive ? (
            <ArrowUpRight className="size-4 text-success" />
          ) : (
            <ArrowDownRight className="size-4 text-muted-foreground" />
          )}
        </div>
        <div>
          <p className="font-semibold text-3xl tracking-tight tabular-nums">{value}</p>
          <p className={cn('mt-1 text-xs', positive ? 'text-success' : 'text-muted-foreground')}>
            {delta}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
