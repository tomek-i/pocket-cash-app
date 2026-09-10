'use client'

import type { PropertyScenario } from '@repo/database'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Button,
  buttonVariants,
  Card,
  CardContent,
} from '@repo/ui'
import { Copy, Pencil, Plus, Trash2 } from 'lucide-react'
import { useActionState, useCallback, useMemo } from 'react'
import { formatMoney } from '@/lib/money'
import { formatPercent } from '../../../_lib/format'
import type { PortfolioInput } from '../../../_lib/portfolio'
import { portfolioImpact } from '../../../_lib/portfolio-impact'
import {
  evaluateScenario,
  isEmptyOverrides,
  type ScenarioBase,
  type ScenarioContext,
  type ScenarioResult,
} from '../../../_lib/scenarios'
import { duplicateScenario, removeScenario } from '../scenarios-actions'
import { ScenarioDialog } from './scenario-dialog'

/**
 * Scenarios side by side.
 *
 * The table reads down a column for one purchase and across a row to compare
 * them, which is why every figure carries its difference from the base
 * underneath. "$6,457" answers nothing on its own; "$412 a month more, and
 * $28,000 more at settlement" is the trade being decided.
 *
 * Every column is recalculated here from the live working inputs, so pushing the
 * price around in the panels above moves the whole comparison with it.
 */

/** What a scenario leaves the portfolio at, alongside the property's own figures. */
export interface ScenarioPortfolio {
  others: PortfolioInput[]
  ownershipShare: number
  maxLvr: number
}

/** A scenario's result, plus where it leaves everything else. */
interface ScenarioColumn extends ScenarioResult {
  /** Decimal ratio across the whole portfolio after buying. */
  portfolioLvr: number
  /** Minor units. Equity gained less the cash it took. */
  equityForCash: number
}

interface MetricRow {
  key: string
  label: string
  read: (result: ScenarioColumn) => number | null
  kind: 'money' | 'percent'
  /** Drawn heavier: the two figures the planner exists to answer. */
  emphasis?: boolean
  /** Only meaningful on a property that is let. */
  rentalOnly?: boolean
}

const METRICS: MetricRow[] = [
  { key: 'purchasePrice', label: 'Purchase price', read: (r) => r.purchasePrice, kind: 'money' },
  { key: 'deposit', label: 'Deposit', read: (r) => r.deposit, kind: 'money' },
  { key: 'loanAmount', label: 'Loan', read: (r) => r.loanAmount, kind: 'money' },
  { key: 'lvr', label: 'LVR', read: (r) => r.lvr, kind: 'percent' },
  { key: 'upfrontCosts', label: 'Upfront costs', read: (r) => r.upfrontCosts, kind: 'money' },
  {
    key: 'cashRequired',
    label: 'Cash required',
    read: (r) => r.cashRequired,
    kind: 'money',
    emphasis: true,
  },
  {
    key: 'monthlyRepayment',
    label: 'Repayment / month',
    read: (r) => r.monthlyRepayment,
    kind: 'money',
  },
  {
    key: 'monthlyPropertyCosts',
    label: 'Holding costs / month',
    read: (r) => r.monthlyPropertyCosts,
    kind: 'money',
  },
  {
    key: 'monthlyRentalIncome',
    label: 'Rent / month',
    read: (r) => r.monthlyRentalIncome,
    kind: 'money',
    rentalOnly: true,
  },
  {
    key: 'monthlyCashFlow',
    label: 'Cash flow / month',
    read: (r) => r.monthlyCashFlow,
    kind: 'money',
    rentalOnly: true,
  },
  {
    key: 'remainingCash',
    label: 'Cash left over',
    read: (r) => r.remainingCash,
    kind: 'money',
    emphasis: true,
  },
  {
    key: 'portfolioLvr',
    label: 'Portfolio LVR after',
    read: (r) => r.portfolioLvr,
    kind: 'percent',
  },
  {
    key: 'equityForCash',
    label: 'Equity less cash',
    read: (r) => r.equityForCash,
    kind: 'money',
    emphasis: true,
  },
]

function format(value: number, kind: MetricRow['kind'], currency: string): string {
  return kind === 'percent' ? formatPercent(value) : formatMoney(value, currency)
}

/**
 * A difference from the base.
 *
 * A percentage difference is quoted in points, because "+19.0%" against an LVR
 * of 71.4% reads as a relative rise and is out by an order of magnitude.
 */
function formatDelta(delta: number, kind: MetricRow['kind'], currency: string): string {
  const sign = delta > 0 ? '+' : '-'
  const size = Math.abs(delta)
  return kind === 'percent'
    ? `${sign}${(size * 100).toFixed(1)} pts`
    : `${sign}${formatMoney(size, currency)}`
}

function DeleteScenario({ scenario }: { scenario: PropertyScenario }) {
  const [, formAction] = useActionState(removeScenario, null)

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button variant="ghost" size="icon" className="size-7" aria-label="Delete scenario">
            <Trash2 className="size-3.5" />
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{scenario.name}”?</AlertDialogTitle>
          <AlertDialogDescription>
            This only removes the scenario. The property and everything on it stays as it is.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <form action={formAction}>
          <input type="hidden" name="id" value={scenario.id} />
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
            <AlertDialogAction type="submit" className={buttonVariants({ variant: 'destructive' })}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function ColumnActions({
  scenario,
  propertyId,
  base,
  isLet,
  baseRent,
  locale,
}: {
  scenario: PropertyScenario
  propertyId: string
  base: ScenarioBase
  isLet: boolean
  baseRent: number | null
  locale: string
}) {
  const [, duplicateAction] = useActionState(duplicateScenario, null)

  return (
    <div className="flex items-center justify-end gap-0.5">
      <ScenarioDialog
        propertyId={propertyId}
        scenario={scenario}
        base={base}
        isLet={isLet}
        baseRent={baseRent}
        locale={locale}
        trigger={
          <Button variant="ghost" size="icon" className="size-7" aria-label="Edit scenario">
            <Pencil className="size-3.5" />
          </Button>
        }
      />
      <form action={duplicateAction}>
        <input type="hidden" name="id" value={scenario.id} />
        <Button
          type="submit"
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label="Duplicate scenario"
        >
          <Copy className="size-3.5" />
        </Button>
      </form>
      <DeleteScenario scenario={scenario} />
    </div>
  )
}

export function ScenarioComparison({
  propertyId,
  scenarios,
  base,
  context,
  currency,
  locale,
  isLet,
  baseRent,
  portfolio,
}: {
  propertyId: string
  scenarios: PropertyScenario[]
  /** The live working inputs, which every column starts from. */
  base: ScenarioBase
  context: ScenarioContext
  currency: string
  locale: string
  isLet: boolean
  /** Minor units, at the property's rent frequency. */
  baseRent: number | null
  portfolio: ScenarioPortfolio
}) {
  // Each column carries where it leaves the portfolio, so a scenario that looks
  // cheaper month to month can still show that it costs borrowing capacity.
  const withPortfolio = useCallback(
    (result: ScenarioResult): ScenarioColumn => {
      const impact = portfolioImpact({
        others: portfolio.others,
        purchase: {
          value: result.propertyValue,
          debt: result.loanAmount,
          ownershipShare: portfolio.ownershipShare,
        },
        cashRequired: result.cashRequired,
        maxLvr: portfolio.maxLvr,
      })
      return { ...result, portfolioLvr: impact.after.lvr, equityForCash: impact.equityForCash }
    },
    [portfolio],
  )

  // The base column is the scenario that overrides nothing, so it goes through
  // exactly the same evaluation as the others. No second code path, no chance of
  // the comparison disagreeing with the panels above.
  const baseResult = useMemo(
    () => withPortfolio(evaluateScenario(base, {}, context)),
    [base, context, withPortfolio],
  )
  const columns = useMemo(
    () =>
      scenarios.map((scenario) => ({
        scenario,
        result: withPortfolio(evaluateScenario(base, scenario.overrides, context)),
      })),
    [scenarios, base, context, withPortfolio],
  )

  const rows = METRICS.filter((metric) => isLet || !metric.rentalOnly)

  const addTrigger = (
    <Button variant="outline" size="sm" className="gap-1.5">
      <Plus className="size-4" />
      Add scenario
    </Button>
  )

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5">
        {scenarios.length === 0 ? (
          <p className="py-2 text-center text-muted-foreground text-sm">
            No scenarios yet. Add one to compare a different price, deposit or rate against what you
            have entered above, without changing it.
          </p>
        ) : (
          <div className="-mx-5 overflow-x-auto px-5">
            <table className="w-full min-w-[36rem] border-collapse text-sm">
              <thead>
                <tr className="border-b">
                  <th className="w-40 py-2 text-left font-medium text-muted-foreground">
                    As entered
                  </th>
                  <th className="px-3 py-2 text-right font-medium">Base</th>
                  {columns.map(({ scenario }) => (
                    <th key={scenario.id} className="min-w-36 px-3 py-2 text-right font-medium">
                      <div className="flex flex-col items-end gap-0.5">
                        <span className="truncate">{scenario.name}</span>
                        <ColumnActions
                          scenario={scenario}
                          propertyId={propertyId}
                          base={base}
                          isLet={isLet}
                          baseRent={baseRent}
                          locale={locale}
                        />
                        {isEmptyOverrides(scenario.overrides) ? (
                          <span className="font-normal text-[11px] text-muted-foreground">
                            changes nothing yet
                          </span>
                        ) : null}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((metric) => {
                  const baseValue = metric.read(baseResult)

                  return (
                    <tr key={metric.key} className="border-b last:border-b-0">
                      <th
                        scope="row"
                        className={
                          metric.emphasis
                            ? 'py-2 text-left font-semibold'
                            : 'py-2 text-left font-normal text-muted-foreground'
                        }
                      >
                        {metric.label}
                      </th>
                      <td
                        className={
                          metric.emphasis
                            ? 'px-3 py-2 text-right font-semibold tabular-nums'
                            : 'px-3 py-2 text-right tabular-nums'
                        }
                      >
                        {baseValue === null ? (
                          '-'
                        ) : (
                          <span
                            className={
                              metric.key === 'remainingCash' && baseResult.shortfall
                                ? 'text-destructive'
                                : undefined
                            }
                          >
                            {format(baseValue, metric.kind, currency)}
                          </span>
                        )}
                      </td>
                      {columns.map(({ scenario, result }) => {
                        const value = metric.read(result)
                        const delta =
                          value === null || baseValue === null ? null : value - baseValue

                        return (
                          <td
                            key={scenario.id}
                            className={
                              metric.emphasis
                                ? 'px-3 py-2 text-right font-semibold tabular-nums'
                                : 'px-3 py-2 text-right tabular-nums'
                            }
                          >
                            {value === null ? (
                              '-'
                            ) : (
                              <div className="flex flex-col items-end">
                                <span
                                  className={
                                    metric.key === 'remainingCash' && result.shortfall
                                      ? 'text-destructive'
                                      : undefined
                                  }
                                >
                                  {format(value, metric.kind, currency)}
                                </span>
                                {delta ? (
                                  <span className="font-normal text-[11px] text-muted-foreground">
                                    {formatDelta(delta, metric.kind, currency)}
                                  </span>
                                ) : null}
                              </div>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex justify-start">
          <ScenarioDialog
            propertyId={propertyId}
            base={base}
            isLet={isLet}
            baseRent={baseRent}
            locale={locale}
            trigger={addTrigger}
          />
        </div>
      </CardContent>
    </Card>
  )
}
