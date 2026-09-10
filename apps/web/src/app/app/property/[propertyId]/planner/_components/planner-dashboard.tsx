import { Card, CardContent, HelpTip } from '@repo/ui'
import { formatMoney } from '@/lib/money'
import { formatPercent } from '../../../_lib/format'
import { lvrHelp } from '../../../_lib/labels'
import type { FinancingResult } from '../../../_lib/planner'

/**
 * The summary at the top of the planner. Every figure here is derived from the
 * working inputs, so it moves as the user types.
 */

function Metric({
  label,
  value,
  hint,
  tone,
  help,
}: {
  label: string
  value: string
  hint?: string
  tone?: 'muted' | 'negative'
  help?: string
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5">
        <p className="text-muted-foreground text-xs">{label}</p>
        {help ? <HelpTip label={`What is ${label.toLowerCase()}?`}>{help}</HelpTip> : null}
      </div>
      <p
        className={
          tone === 'muted'
            ? 'font-medium text-lg text-muted-foreground'
            : tone === 'negative'
              ? 'font-semibold text-destructive text-lg'
              : 'font-semibold text-lg'
        }
      >
        {value}
      </p>
      {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
    </div>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-5">
        <p className="font-medium text-muted-foreground text-sm">{title}</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3">{children}</div>
      </CardContent>
    </Card>
  )
}

export function PlannerDashboard({
  result,
  currency,
  upfrontCosts,
  cashRequired,
  monthlyPropertyCosts,
  monthlyRentalIncome,
  monthlyCashFlow,
  availableCash,
  remainingCash,
  maxPortfolioLvr,
}: {
  result: FinancingResult
  currency: string
  /** Minor units. Total of the enabled upfront costs. */
  upfrontCosts: number
  /** Minor units. Deposit plus upfront costs. */
  cashRequired: number
  /** Minor units per month. Holding costs, excluding the loan. */
  monthlyPropertyCosts: number
  /** Minor units per month, after vacancy and management. Null when not let. */
  monthlyRentalIncome: number | null
  /** Minor units per month, after every cost including principal. Null when not let. */
  monthlyCashFlow: number | null
  /** Minor units. Total of the enabled funds. */
  availableCash: number
  /** Minor units. Negative means the purchase is short. */
  remainingCash: number
  /** Decimal. The configured LVR ceiling, quoted in the LVR explanation. */
  maxPortfolioLvr: number
}) {
  const { financing, amortisation } = result

  return (
    <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
      <Panel title="Purchase">
        <Metric label="Purchase price" value={formatMoney(financing.purchasePrice, currency)} />
        <Metric label="Upfront costs" value={formatMoney(upfrontCosts, currency)} />
        <Metric label="Deposit" value={formatMoney(financing.deposit, currency)} />
        <Metric label="Cash required" value={formatMoney(cashRequired, currency)} />
      </Panel>

      <Panel title="Financing">
        <Metric label="Loan amount" value={formatMoney(financing.loanAmount, currency)} />
        <Metric
          label="LVR"
          value={result.propertyValue > 0 ? formatPercent(financing.lvr) : '—'}
          help={lvrHelp(maxPortfolioLvr)}
        />
        <Metric
          label="Monthly repayment"
          value={formatMoney(amortisation.monthlyRepayment, currency)}
        />
        <Metric
          label="Annual repayment"
          value={formatMoney(amortisation.annualRepayment, currency)}
        />
      </Panel>

      <Panel title="Cash position">
        <Metric label="Available cash" value={formatMoney(availableCash, currency)} />
        <Metric label="Cash required" value={formatMoney(cashRequired, currency)} />
        <Metric
          label="Remaining"
          value={formatMoney(remainingCash, currency)}
          tone={remainingCash < 0 ? 'negative' : undefined}
        />
        <Metric
          label="Equity at settlement"
          value={formatMoney(result.propertyValue - financing.loanAmount, currency)}
        />
      </Panel>

      <Panel title="Ongoing">
        <Metric
          label="Monthly property costs"
          value={formatMoney(monthlyPropertyCosts, currency)}
        />
        <Metric
          label="Monthly rental income"
          value={monthlyRentalIncome === null ? '—' : formatMoney(monthlyRentalIncome, currency)}
          tone={monthlyRentalIncome === null ? 'muted' : undefined}
          hint={monthlyRentalIncome === null ? 'Not let' : 'After vacancy and management'}
        />
        <Metric
          label="Net monthly cash flow"
          value={monthlyCashFlow === null ? '—' : formatMoney(monthlyCashFlow, currency)}
          tone={monthlyCashFlow === null ? 'muted' : monthlyCashFlow < 0 ? 'negative' : undefined}
          hint={monthlyCashFlow === null ? 'Not let' : 'Includes principal'}
        />
        <Metric
          label="Monthly loan repayment"
          value={formatMoney(amortisation.monthlyRepayment, currency)}
        />
      </Panel>
    </div>
  )
}
