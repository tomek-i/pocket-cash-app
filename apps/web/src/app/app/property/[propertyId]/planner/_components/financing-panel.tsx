'use client'

import { LOAN_TYPES, type LoanType } from '@repo/property'
import {
  Button,
  Card,
  CardContent,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui'
import { useActionState } from 'react'
import type { ActionState } from '@/lib/action-state'
import { formatMoney } from '@/lib/money'
import { MoneyInput } from '../../../_components/money-input'
import { formatPercent } from '../../../_lib/format'
import { LOAN_TYPE_LABELS } from '../../../_lib/labels'
import type { PlannerInputs } from '../../../_lib/use-planner-inputs'
import { type PlannerProperty, savePlannerFinancing } from '../actions'

/** A labelled input for the values that are not money: percentages and years. */
function PlainField({
  label,
  id,
  value,
  onChange,
}: {
  label: string
  id: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        inputMode="decimal"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}

function Figure({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: string
  hint?: string
  tone?: 'negative'
}) {
  return (
    <div className="min-w-0">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className={tone === 'negative' ? 'font-medium text-destructive' : 'font-medium'}>
        {value}
      </p>
      {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
    </div>
  )
}

/**
 * The financing section.
 *
 * Figures update as the user types, computed in the browser by the same
 * `@repo/property` engine the server uses, so nothing round-trips just to show
 * a repayment. `source` records which of deposit, deposit percentage and loan
 * amount was edited last; the other two follow from it. Without that the three
 * fields overwrite each other while being typed into.
 */
export function FinancingPanel({
  property,
  locale,
  inputs,
  cashRequired,
  cashLeftOver,
}: {
  property: PlannerProperty
  locale: string
  /** Held by the workspace, so the upfront costs see the same numbers. */
  inputs: PlannerInputs
  /**
   * Minor units. Deposit plus upfront costs.
   *
   * Repeated here, a screen below where the dashboard already shows it, because
   * this is where the deposit and the price are actually typed. Live recalculation
   * is worth nothing if the figure it recalculates is scrolled off the top while
   * you work the lever that changes it.
   */
  cashRequired: number
  /** Minor units. Null when no funds are recorded, so the position is unknown. */
  cashLeftOver: number | null
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    savePlannerFinancing,
    null,
  )

  const { values, loanType, source, setValue, setLoanType, setFinancingValue, shown } = inputs
  const result = inputs.result
  const currency = property.currency
  const { financing, amortisation } = result

  const hasOffset = result.effectiveLoanBalance !== financing.loanAmount

  return (
    <Card>
      <CardContent className="flex flex-col gap-6 p-5">
        <form action={formAction} className="flex flex-col gap-6">
          <input type="hidden" name="id" value={property.id} />
          <input type="hidden" name="source" value={source} />
          <input type="hidden" name="purchasePrice" value={values.purchasePrice} />
          <input type="hidden" name="marketValue" value={values.marketValue} />
          <input type="hidden" name="deposit" value={shown.deposit} />
          <input type="hidden" name="depositPercentage" value={shown.depositPercentage} />
          <input type="hidden" name="loanAmount" value={shown.loanAmount} />
          <input type="hidden" name="interestRate" value={values.interestRate} />
          <input type="hidden" name="loanTermYears" value={values.termYears} />
          <input type="hidden" name="loanType" value={loanType} />
          <input type="hidden" name="offsetBalance" value={values.offsetBalance} />
          <input type="hidden" name="otherFinancingCosts" value={values.otherCosts} />

          <div className="grid gap-4 sm:grid-cols-2">
            <MoneyInput
              label="Purchase price"
              id="purchasePrice"
              locale={locale}
              value={values.purchasePrice}
              onCanonicalChange={(next) => setValue('purchasePrice', next)}
              placeholder={950000}
            />
            <MoneyInput
              label="Estimated market value"
              id="marketValue"
              locale={locale}
              value={values.marketValue}
              onCanonicalChange={(next) => setValue('marketValue', next)}
              placeholder={980000}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <MoneyInput
              label="Deposit"
              id="deposit"
              locale={locale}
              value={shown.deposit}
              onCanonicalChange={(next) => setFinancingValue('deposit', next)}
              placeholder={200000}
            />
            <PlainField
              label="Deposit (%)"
              id="depositPercentage"
              value={shown.depositPercentage}
              onChange={(next) => setFinancingValue('depositPercentage', next)}
            />
            <MoneyInput
              label="Loan amount"
              id="loanAmount"
              locale={locale}
              value={shown.loanAmount}
              onCanonicalChange={(next) => setFinancingValue('loanAmount', next)}
              placeholder={760000}
            />
          </div>

          {financing.depositExceedsPrice ? (
            <p className="text-destructive text-sm">
              The deposit is more than the purchase price, so there is nothing left to borrow.
            </p>
          ) : null}

          {financing.deposit < 0 ? (
            <p className="text-muted-foreground text-sm">
              The loan is {formatMoney(Math.abs(financing.deposit), currency)} more than the
              purchase price, which is why the deposit reads as a negative. That is normal on a
              property owned for a while: the price is what was paid, and the loan has been drawn
              against what it is worth now.
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-4">
            <PlainField
              label="Interest rate (%)"
              id="interestRate"
              value={values.interestRate}
              onChange={(next) => setValue('interestRate', next)}
            />
            <PlainField
              label="Term (years)"
              id="termYears"
              value={values.termYears}
              onChange={(next) => setValue('termYears', next)}
            />
            <div className="grid gap-1.5">
              <Label htmlFor="loanType">Loan type</Label>
              <Select
                name="loanTypeSelect"
                value={loanType}
                items={LOAN_TYPE_LABELS}
                onValueChange={(value) => value && setLoanType(value as LoanType)}
              >
                <SelectTrigger id="loanType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LOAN_TYPES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {LOAN_TYPE_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <MoneyInput
              label="Offset balance"
              id="offsetBalance"
              locale={locale}
              value={values.offsetBalance}
              onCanonicalChange={(next) => setValue('offsetBalance', next)}
              placeholder={0}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <MoneyInput
              label="Other financing costs"
              id="otherCosts"
              locale={locale}
              value={values.otherCosts}
              onCanonicalChange={(next) => setValue('otherCosts', next)}
              placeholder={0}
            />
          </div>

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : 'Save financing'}
            </Button>
            {state?.ok ? <span className="text-muted-foreground text-sm">Saved.</span> : null}
          </div>
        </form>

        <div className="grid gap-4 border-t pt-5 sm:grid-cols-3 lg:grid-cols-4">
          <Figure
            label="Cash required"
            value={formatMoney(cashRequired, currency)}
            hint="Deposit plus upfront costs"
          />
          <Figure
            label="Cash left over"
            value={cashLeftOver === null ? '—' : formatMoney(cashLeftOver, currency)}
            hint={cashLeftOver === null ? 'No funds recorded yet' : undefined}
            tone={cashLeftOver !== null && cashLeftOver < 0 ? 'negative' : undefined}
          />
          <Figure label="Loan amount" value={formatMoney(financing.loanAmount, currency)} />
          <Figure label="Deposit" value={formatMoney(financing.deposit, currency)} />
          <Figure
            label="LVR"
            value={result.propertyValue > 0 ? formatPercent(financing.lvr) : '—'}
            hint={`against ${formatMoney(result.propertyValue, currency)}`}
          />
          <Figure
            label="Monthly repayment"
            value={formatMoney(amortisation.monthlyRepayment, currency)}
            hint={
              hasOffset
                ? `${formatMoney(result.offsetAdjustedMonthlyRepayment, currency)} with offset`
                : undefined
            }
          />
          <Figure
            label="Annual repayment"
            value={formatMoney(amortisation.annualRepayment, currency)}
          />
          <Figure
            label="Total interest"
            value={formatMoney(amortisation.totalInterest, currency)}
            hint={`over ${values.termYears || 0} years`}
          />
          <Figure
            label="Year 1 principal"
            value={formatMoney(amortisation.principalYear1, currency)}
          />
          <Figure
            label="Year 1 interest"
            value={formatMoney(amortisation.interestYear1, currency)}
          />
          <Figure
            label="Balance after 1 year"
            value={formatMoney(amortisation.balanceAfter1Year, currency)}
          />
          <Figure
            label="Balance after 5 years"
            value={formatMoney(amortisation.balanceAfter5Years, currency)}
          />
          <Figure
            label="Balance after 10 years"
            value={formatMoney(amortisation.balanceAfter10Years, currency)}
          />
        </div>
      </CardContent>
    </Card>
  )
}
