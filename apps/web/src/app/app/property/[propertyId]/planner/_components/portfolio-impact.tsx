'use client'

import { Card, CardContent } from '@repo/ui'
import { formatMoney } from '@/lib/money'
import { formatPercent } from '../../../_lib/format'
import type { PortfolioImpact } from '../../../_lib/portfolio-impact'

/**
 * Where the purchase leaves everything else.
 *
 * The rest of the planner answers what the purchase costs. This answers what it
 * does to you, and the two come apart: cash required tells you what leaves the
 * account, and nothing until now told you how much of it comes back as equity.
 *
 * Read the Change column. The absolute figures are context; the differences are
 * the decision.
 */

function Row({
  label,
  now,
  after,
  change,
  hint,
  emphasis,
  tone,
}: {
  label: string
  now: string
  after: string
  change: string
  hint?: string
  emphasis?: boolean
  tone?: 'negative' | 'positive'
}) {
  return (
    <tr className="border-b last:border-b-0">
      <th
        scope="row"
        className={
          emphasis
            ? 'py-2 text-left font-semibold'
            : 'py-2 text-left font-normal text-muted-foreground'
        }
      >
        {label}
        {hint ? <p className="font-normal text-[11px] text-muted-foreground">{hint}</p> : null}
      </th>
      <td className="px-3 py-2 text-right tabular-nums">{now}</td>
      <td className="px-3 py-2 text-right tabular-nums">{after}</td>
      <td
        className={
          tone === 'negative'
            ? 'px-3 py-2 text-right font-semibold text-destructive tabular-nums'
            : tone === 'positive'
              ? 'px-3 py-2 text-right font-semibold text-success tabular-nums'
              : 'px-3 py-2 text-right font-semibold tabular-nums'
        }
      >
        {change}
      </td>
    </tr>
  )
}

/** A signed money difference. */
function delta(value: number, currency: string): string {
  return `${value >= 0 ? '+' : '-'}${formatMoney(Math.abs(value), currency)}`
}

/** A signed LVR difference, in points. A percentage difference would mislead. */
function deltaPoints(value: number): string {
  return `${value >= 0 ? '+' : '-'}${(Math.abs(value) * 100).toFixed(1)} pts`
}

export function PortfolioImpactPanel({
  impact,
  currency,
  maxLvr,
}: {
  impact: PortfolioImpact
  currency: string
  /** Decimal, for the headroom caption. */
  maxLvr: number
}) {
  const { now, after, change, headroom, equityForCash } = impact
  const firstPurchase = now.count === 0

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5">
        <div className="-mx-5 overflow-x-auto px-5">
          <table className="w-full min-w-[32rem] border-collapse text-sm">
            <thead>
              <tr className="border-b">
                <th className="w-48 py-2 text-left font-medium text-muted-foreground">
                  {firstPurchase ? 'Nothing owned yet' : `Across ${now.count} owned`}
                </th>
                <th className="px-3 py-2 text-right font-medium">Now</th>
                <th className="px-3 py-2 text-right font-medium">After buying</th>
                <th className="px-3 py-2 text-right font-medium">Change</th>
              </tr>
            </thead>
            <tbody>
              <Row
                label="Value"
                now={formatMoney(now.value, currency)}
                after={formatMoney(after.value, currency)}
                change={delta(change.value, currency)}
              />
              <Row
                label="Debt"
                now={formatMoney(now.debt, currency)}
                after={formatMoney(after.debt, currency)}
                change={delta(change.debt, currency)}
              />
              <Row
                label="Equity"
                now={formatMoney(now.equity, currency)}
                after={formatMoney(after.equity, currency)}
                change={delta(change.equity, currency)}
                emphasis
              />
              <Row
                label="Portfolio LVR"
                now={formatPercent(now.lvr)}
                after={formatPercent(after.lvr)}
                change={deltaPoints(change.lvr)}
              />
              <Row
                label="Borrowing headroom"
                hint={`Before hitting ${formatPercent(maxLvr, 0)}`}
                now={formatMoney(headroom.now, currency)}
                after={formatMoney(headroom.after, currency)}
                change={delta(headroom.change, currency)}
                tone={headroom.change < 0 ? 'negative' : undefined}
              />
            </tbody>
          </table>
        </div>

        {equityForCash === null ? null : (
          <div className="border-t pt-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-semibold text-sm">Equity gained, less the cash it took</p>
              <p
                className={
                  equityForCash < 0
                    ? 'font-semibold text-destructive tabular-nums'
                    : 'font-semibold text-success tabular-nums'
                }
              >
                {delta(equityForCash, currency)}
              </p>
            </div>
            <p className="mt-1 text-muted-foreground text-xs">
              {equityForCash < 0
                ? 'What you hand over at settlement is more than the equity it buys. The gap is the upfront costs, plus anything paid above what the place is valued at.'
                : 'The equity gained is more than the cash it took, which happens when the price is under the valuation by more than the upfront costs.'}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
