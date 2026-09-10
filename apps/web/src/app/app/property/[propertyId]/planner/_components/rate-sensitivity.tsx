'use client'

import type { LoanTerms } from '@repo/property'
import { sensitivity } from '@repo/property'
import { Card, CardContent } from '@repo/ui'
import { useMemo } from 'react'
import { formatMoney } from '@/lib/money'
import { formatPercent } from '../../../_lib/format'

/**
 * What the repayment becomes at other rates.
 *
 * A stress test on the largest and longest commitment in the purchase: the rate
 * is fixed today and the loan is not. The row matching the loan's own rate is
 * marked, and every other row is shown as a difference from it, because the
 * useful number is not "$6,237" but "$1,003 a month more than I planned for".
 *
 * The rates come from Settings > Property, not from a constant here, so nothing
 * assumes a particular country's band of plausible rates.
 */
export function RateSensitivity({
  terms,
  rates,
  currency,
}: {
  terms: LoanTerms
  /** Decimal annual rates, from the calculation defaults. */
  rates: number[]
  currency: string
}) {
  // The loan's own rate is always included, so there is something to compare to
  // even when it sits between the configured bands.
  const allRates = useMemo(() => {
    const set = new Set([...rates, terms.annualRate].filter((rate) => rate > 0))
    return [...set].sort((a, b) => a - b)
  }, [rates, terms.annualRate])

  const rows = useMemo(() => sensitivity(allRates, terms), [allRates, terms])

  if (terms.principal <= 0 || terms.termYears <= 0) {
    return (
      <Card>
        <CardContent className="p-5">
          <p className="text-muted-foreground text-sm">
            Enter a loan amount and a term above to see how the repayment moves with the rate.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-5">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="text-left text-muted-foreground text-xs">
                <th className="pb-2 font-medium">Interest rate</th>
                <th className="pb-2 text-right font-medium">Monthly repayment</th>
                <th className="pb-2 text-right font-medium">Difference</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isCurrent = row.annualRate === terms.annualRate
                return (
                  <tr key={row.annualRate} className="border-t">
                    <td className={isCurrent ? 'py-2 font-medium' : 'py-2'}>
                      {formatPercent(row.annualRate, 2)}
                      {isCurrent ? (
                        <span className="ml-2 text-muted-foreground text-xs">your rate</span>
                      ) : null}
                    </td>
                    <td
                      className={
                        isCurrent
                          ? 'py-2 text-right font-medium tabular-nums'
                          : 'py-2 text-right tabular-nums'
                      }
                    >
                      {formatMoney(row.monthlyRepayment, currency)}
                    </td>
                    <td
                      className={
                        row.monthlyDifference > 0
                          ? 'py-2 text-right text-destructive tabular-nums'
                          : 'py-2 text-right text-muted-foreground tabular-nums'
                      }
                    >
                      {row.monthlyDifference === 0
                        ? '—'
                        : `${row.monthlyDifference > 0 ? '+' : ''}${formatMoney(
                            row.monthlyDifference,
                            currency,
                          )}`}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
