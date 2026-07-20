'use client'

import { Button, Card, CardContent, cn } from '@repo/ui'
import { Download, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { formatMoney } from '@/lib/money'
import type { FyTaxSummary } from '../../tax-actions'
import { ExportTransactionsButton } from './export-transactions-button'

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

function buildCsv(summary: FyTaxSummary): string {
  const lines = [['Section', 'Category', 'Count', 'Total'].join(',')]
  const push = (section: string, rows: FyTaxSummary['income']) => {
    for (const r of rows) {
      lines.push(
        [section, csvEscape(r.label), String(r.count), (r.total / 100).toFixed(2)].join(','),
      )
    }
  }
  push('Income', summary.income)
  push('Expenses', summary.expenses)
  if (summary.taxTagged) push('Tax-tagged', summary.taxTagged.byCategory)
  return lines.join('\n')
}

function SummaryTable({
  title,
  rows,
  total,
  currency,
  totalClass,
}: {
  title: string
  rows: FyTaxSummary['income']
  total: number
  currency: string
  totalClass?: string
}) {
  return (
    <div className="flex min-w-56 flex-1 flex-col gap-1.5">
      <p className="font-medium text-sm">{title}</p>
      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">None.</p>
      ) : (
        <ul className="flex flex-col">
          {rows.map((r) => (
            <li
              key={r.label}
              className="flex items-center justify-between gap-3 border-border/60 border-b py-1.5 text-sm last:border-0"
            >
              <span className="truncate text-muted-foreground">
                {r.label} <span className="text-xs">· {r.count}</span>
              </span>
              <span className="tabular-nums">{formatMoney(r.total, currency)}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-0.5 flex items-center justify-between gap-3 border-t pt-1.5 font-medium text-sm">
        <span>Total</span>
        <span className={cn('tabular-nums', totalClass)}>{formatMoney(total, currency)}</span>
      </div>
    </div>
  )
}

export function TaxHelper({
  fy,
  currency,
  summary,
  aiConfigured,
  taxTagId,
  from,
  to,
}: {
  fy: number
  currency: string
  summary: FyTaxSummary
  aiConfigured: boolean
  /** Id of the "tax" tag, if it exists — enables the per-tag transaction export. */
  taxTagId?: string
  /** FY date bounds (inclusive) for scoping the transaction export. */
  from: string
  to: string
}) {
  const exportCsv = () => {
    const blob = new Blob([buildCsv(summary)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pocket-cash-tax-FY${fy}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-semibold text-lg">Tax helper</h2>
          <p className="text-muted-foreground text-sm">
            An accountant-ready breakdown of the year, and an AI scan for possible deductions.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          render={<Link href={`/app/reports/${fy}/tax`} />}
          nativeButton={false}
        >
          <Sparkles className="size-4" />
          Find tax-related transactions
        </Button>
      </div>

      {/* Accountant-ready summary */}
      <Card>
        <CardContent className="flex flex-col gap-4 p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium text-sm">FY{fy} summary</p>
            <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={exportCsv}>
              <Download className="size-4" />
              Export summary
            </Button>
          </div>
          <div className="flex flex-wrap gap-8">
            <SummaryTable
              title="Income by category"
              rows={summary.income}
              total={summary.totalIncome}
              currency={currency}
              totalClass="text-success"
            />
            <SummaryTable
              title="Expenses by category"
              rows={summary.expenses}
              total={summary.totalExpenses}
              currency={currency}
              totalClass="text-destructive"
            />
          </div>

          {summary.taxTagged ? (
            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-sm">
                  Tagged “tax” · {summary.taxTagged.count} item
                  {summary.taxTagged.count === 1 ? '' : 's'}
                </p>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm tabular-nums">
                    {formatMoney(summary.taxTagged.total, currency)}
                  </span>
                  {taxTagId ? (
                    <ExportTransactionsButton
                      filters={{ from, to, tagId: taxTagId }}
                      filename={`pocket-cash-FY${fy}-tax-transactions.csv`}
                      label="Export transactions"
                    />
                  ) : null}
                </div>
              </div>
              <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                {summary.taxTagged.byCategory.map((r) => (
                  <li key={r.label} className="text-muted-foreground text-xs">
                    {r.label}: {formatMoney(r.total, currency)}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-muted-foreground text-xs">
              No transactions tagged “tax” yet.{' '}
              {aiConfigured ? (
                <Link href={`/app/reports/${fy}/tax`} className="text-primary hover:underline">
                  Find tax-related transactions
                </Link>
              ) : (
                'Tag some from any transaction to build your deduction list.'
              )}
            </p>
          )}

          <p className="text-[11px] text-muted-foreground">
            Suggestions and totals only — this is not tax advice. Confirm everything with a
            registered tax agent.
          </p>
        </CardContent>
      </Card>
    </section>
  )
}
