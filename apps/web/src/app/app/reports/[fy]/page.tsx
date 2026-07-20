import { Card, CardContent, cn } from '@repo/ui'
import { ArrowLeftRight, ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { formatMoney, parseAmountToMinor } from '@/lib/money'
import { DonutChart } from '../../_components/charts'
import { Empty } from '../../_components/empty'
import { InsightCard } from '../../_components/insight-card'
import { Pagination } from '../../_components/pagination'
import { listAllAccounts } from '../../accounts/actions'
import { listCategories } from '../../categories/actions'
import { getDefaultCurrency, isAiConfigured } from '../../settings/actions'
import { listTags } from '../../tags/actions'
import {
  type FilterAccount,
  TransactionFilters,
} from '../../transactions/_components/transaction-filters'
import { TransactionsTable } from '../../transactions/_components/transactions-table'
import { listTransactions } from '../../transactions/actions'
import { generateFyInsight, getFyInsight } from '../insights-actions'
import {
  currentFy,
  fyBounds,
  fyRangeLabel,
  getFyCategoryBreakdowns,
  listFinancialYears,
} from '../queries'
import { getFyTaxSummary } from '../tax-actions'
import { ExportTransactionsButton } from './_components/export-transactions-button'
import { TaxHelper } from './_components/tax-helper'

export const metadata = { title: 'Financial year' }

interface SearchParams {
  account?: string
  tag?: string
  q?: string
  category?: string
  min?: string
  max?: string
  page?: string
}

/** Filename-safe slug of a tag name, e.g. "Tax 2025" → "tax-2025". */
function slug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'tag'
  )
}

function buildHref(fy: number, params: SearchParams, page: number): string {
  const sp = new URLSearchParams()
  if (params.account) sp.set('account', params.account)
  if (params.tag) sp.set('tag', params.tag)
  if (params.q) sp.set('q', params.q)
  if (params.category) sp.set('category', params.category)
  if (params.min) sp.set('min', params.min)
  if (params.max) sp.set('max', params.max)
  if (page > 1) sp.set('page', String(page))
  const qs = sp.toString()
  return qs ? `/app/reports/${fy}?${qs}` : `/app/reports/${fy}`
}

export default async function FyReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ fy: string }>
  searchParams: Promise<SearchParams>
}) {
  const { fy: fyStr } = await params
  const sp = await searchParams
  const fy = Number(fyStr)
  if (!Number.isInteger(fy) || fy < 1970 || fy > currentFy() + 1) notFound()

  const bounds = fyBounds(fy)
  const page = Math.max(1, Number(sp.page) || 1)
  const amountMin = parseAmountToMinor(sp.min)
  const amountMax = parseAmountToMinor(sp.max)

  // Date range is fixed to the FY — the rest of the filters mirror the main list.
  const txnFilters = {
    from: bounds.start,
    to: bounds.endInclusive,
    accountId: sp.account,
    tagId: sp.tag,
    q: sp.q,
    category: sp.category,
    amountMin,
    amountMax,
  }

  const [
    data,
    years,
    breakdowns,
    accounts,
    categories,
    tags,
    currency,
    aiConfigured,
    insight,
    taxSummary,
  ] = await Promise.all([
    listTransactions({ ...txnFilters, page }),
    listFinancialYears(),
    getFyCategoryBreakdowns(),
    listAllAccounts(),
    listCategories(),
    listTags(),
    getDefaultCurrency(),
    isAiConfigured(),
    getFyInsight(fy),
    getFyTaxSummary(fy),
  ])
  const summary = years.find((y) => y.fy === fy)
  const breakdown = breakdowns.get(fy)
  const taxTagId = tags.find((t) => t.name.toLowerCase() === 'tax')?.id
  const activeTag = sp.tag ? tags.find((t) => t.id === sp.tag) : undefined
  const filterAccounts: FilterAccount[] = accounts.map((a) => ({
    id: a.id,
    label: `${a.bank.name} · ${a.name}`,
  }))
  const hasActiveFilters = Boolean(sp.account || sp.tag || sp.q || sp.category || sp.min || sp.max)

  return (
    <div className="flex flex-col gap-6 px-5 py-5 lg:px-8 lg:py-7">
      <div className="flex flex-col gap-2">
        <Link
          href="/app/reports"
          className="flex w-fit items-center gap-1 text-muted-foreground text-sm hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          Reports
        </Link>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="font-semibold text-2xl tracking-tight">FY{fy}</h1>
          <p className="text-muted-foreground text-sm">{fyRangeLabel(fy)}</p>
        </div>
      </div>

      {summary ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            label="Income"
            value={formatMoney(summary.income, currency)}
            className="text-success"
          />
          <StatCard
            label="Spending"
            value={formatMoney(summary.spending, currency)}
            className="text-destructive"
          />
          <StatCard
            label="Net"
            value={formatMoney(summary.net, currency)}
            className={summary.net >= 0 ? 'text-success' : 'text-destructive'}
          />
          <StatCard label="Transactions" value={String(summary.count)} />
        </div>
      ) : null}

      {breakdown && breakdown.total > 0 ? (
        <Card>
          <CardContent className="flex flex-col gap-1 p-5">
            <p className="mb-2 font-medium text-sm">Spending by category</p>
            <div className="flex flex-wrap items-center gap-6">
              <DonutChart
                data={breakdown.slices}
                centerValue={formatMoney(breakdown.total, currency)}
                centerLabel="spent"
                className="shrink-0"
              />
              <ul className="flex min-w-48 flex-1 flex-col gap-2">
                {breakdown.slices.map((s) => (
                  <li key={s.label} className="flex items-center gap-2 text-sm">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: s.color }}
                    />
                    <span className="flex-1 truncate text-muted-foreground">{s.label}</span>
                    <span className="font-medium tabular-nums">
                      {formatMoney(s.value, currency)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {summary && summary.count > 0 ? (
        <InsightCard
          aiConfigured={aiConfigured}
          initial={insight}
          generate={generateFyInsight.bind(null, fy)}
          prompt="Get a plain-English rundown of this financial year — income vs spending, savings, and where the money went."
        />
      ) : null}

      {summary && summary.count > 0 ? (
        <TaxHelper
          fy={fy}
          currency={currency}
          summary={taxSummary}
          aiConfigured={aiConfigured}
          taxTagId={taxTagId}
          from={bounds.start}
          to={bounds.endInclusive}
        />
      ) : null}

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-muted-foreground text-sm">
            Search and filter within FY{fy} — the date range is fixed to this year.
          </p>
          {data.total > 0 ? (
            <ExportTransactionsButton
              filters={txnFilters}
              filename={`pocket-cash-FY${fy}${activeTag ? `-${slug(activeTag.name)}` : ''}-transactions.csv`}
              label="Export CSV"
              className="h-9 gap-1.5"
            />
          ) : null}
        </div>
        <TransactionFilters
          accounts={filterAccounts}
          categories={categories}
          tags={tags}
          showDateRange={false}
          current={{
            accountId: sp.account,
            q: sp.q,
            category: sp.category,
            tag: sp.tag,
            amountMin: sp.min,
            amountMax: sp.max,
          }}
        />
      </div>

      {data.total === 0 ? (
        <Card>
          <Empty
            className="p-12"
            icon={ArrowLeftRight}
            title="No transactions"
            description={
              hasActiveFilters
                ? 'No transactions match these filters in this financial year.'
                : 'No transactions in this financial year.'
            }
          />
        </Card>
      ) : (
        <TransactionsTable rows={data.rows} categories={categories} tags={tags} />
      )}

      <Pagination
        page={data.page}
        pageSize={data.pageSize}
        total={data.total}
        hrefFor={(p) => buildHref(fy, sp, p)}
      />
    </div>
  )
}

function StatCard({
  label,
  value,
  className,
}: {
  label: string
  value: string
  className?: string
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className={cn('mt-0.5 font-semibold text-lg tabular-nums', className)}>{value}</p>
      </CardContent>
    </Card>
  )
}
