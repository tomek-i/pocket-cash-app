'use client'

import { type FinancingSource, LOAN_TYPES, type LoanType } from '@repo/property'
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
import { useActionState, useMemo, useState } from 'react'
import type { ActionState } from '@/lib/action-state'
import { formatMoney } from '@/lib/money'
import { formatPercent, toMajorInput, toMinorUnits, toRateDecimal } from '../../../_lib/format'
import { LOAN_TYPE_LABELS } from '../../../_lib/labels'
import { buildFinancing } from '../../../_lib/planner'
import { type PlannerProperty, savePlannerFinancing } from '../actions'

function MoneyField({
  label,
  id,
  value,
  onChange,
  hint,
}: {
  label: string
  id: string
  value: string
  onChange: (value: string) => void
  hint?: string
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
      {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
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
export function FinancingPanel({ property }: { property: PlannerProperty }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    savePlannerFinancing,
    null,
  )

  const loan = property.loans[0]

  const [purchasePrice, setPurchasePrice] = useState(toMajorInput(property.purchasePrice))
  const [marketValue, setMarketValue] = useState(toMajorInput(property.estimatedMarketValue))
  const [deposit, setDeposit] = useState(
    toMajorInput(Math.max(0, property.purchasePrice - (loan?.loanAmount ?? 0))),
  )
  const [depositPercentage, setDepositPercentage] = useState(() => {
    if (!property.purchasePrice) return '20'
    const value = (property.purchasePrice - (loan?.loanAmount ?? 0)) / property.purchasePrice
    return (value * 100).toFixed(2)
  })
  const [loanAmount, setLoanAmount] = useState(toMajorInput(loan?.loanAmount ?? 0))
  const [source, setSource] = useState<FinancingSource>('deposit')

  const [interestRate, setInterestRate] = useState(loan ? (loan.annualRate * 100).toString() : '6')
  const [termYears, setTermYears] = useState(loan ? String(loan.termYears) : '30')
  const [loanType, setLoanType] = useState<LoanType>(loan?.loanType ?? 'principalAndInterest')
  const [offsetBalance, setOffsetBalance] = useState(toMajorInput(loan?.offsetBalance ?? 0))
  const [otherCosts, setOtherCosts] = useState(toMajorInput(loan?.otherFinancingCosts ?? 0))

  const result = useMemo(
    () =>
      buildFinancing({
        purchasePrice: toMinorUnits(purchasePrice),
        estimatedMarketValue: marketValue ? toMinorUnits(marketValue) : null,
        currentValue: property.currentValue,
        source,
        deposit: toMinorUnits(deposit),
        depositPercentage: toRateDecimal(depositPercentage),
        loanAmount: toMinorUnits(loanAmount),
        annualRate: toRateDecimal(interestRate),
        termYears: Number.parseInt(termYears, 10) || 0,
        loanType,
        offsetBalance: toMinorUnits(offsetBalance),
      }),
    [
      purchasePrice,
      marketValue,
      property.currentValue,
      source,
      deposit,
      depositPercentage,
      loanAmount,
      interestRate,
      termYears,
      loanType,
      offsetBalance,
    ],
  )

  const currency = property.currency
  const { financing, amortisation } = result

  // The two fields the user is not editing follow the derived figures, so the
  // panel always shows a consistent set of three.
  const shownDeposit = source === 'deposit' ? deposit : toMajorInput(financing.deposit)
  const shownDepositPercentage =
    source === 'depositPercentage'
      ? depositPercentage
      : (financing.depositPercentage * 100).toFixed(2)
  const shownLoanAmount = source === 'loanAmount' ? loanAmount : toMajorInput(financing.loanAmount)

  const hasOffset = result.effectiveLoanBalance !== financing.loanAmount

  return (
    <Card>
      <CardContent className="flex flex-col gap-6 p-5">
        <form action={formAction} className="flex flex-col gap-6">
          <input type="hidden" name="id" value={property.id} />
          <input type="hidden" name="source" value={source} />
          <input type="hidden" name="purchasePrice" value={purchasePrice} />
          <input type="hidden" name="estimatedMarketValue" value={marketValue} />
          <input type="hidden" name="deposit" value={shownDeposit} />
          <input type="hidden" name="depositPercentage" value={shownDepositPercentage} />
          <input type="hidden" name="loanAmount" value={shownLoanAmount} />
          <input type="hidden" name="interestRate" value={interestRate} />
          <input type="hidden" name="loanTermYears" value={termYears} />
          <input type="hidden" name="loanType" value={loanType} />
          <input type="hidden" name="offsetBalance" value={offsetBalance} />
          <input type="hidden" name="otherFinancingCosts" value={otherCosts} />

          <div className="grid gap-4 sm:grid-cols-2">
            <MoneyField
              label="Purchase price"
              id="purchasePrice"
              value={purchasePrice}
              onChange={setPurchasePrice}
            />
            <MoneyField
              label="Estimated market value"
              id="marketValue"
              value={marketValue}
              onChange={setMarketValue}
              hint="LVR is measured against this when set."
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <MoneyField
              label="Deposit"
              id="deposit"
              value={shownDeposit}
              onChange={(value) => {
                setSource('deposit')
                setDeposit(value)
              }}
            />
            <MoneyField
              label="Deposit (%)"
              id="depositPercentage"
              value={shownDepositPercentage}
              onChange={(value) => {
                setSource('depositPercentage')
                setDepositPercentage(value)
              }}
            />
            <MoneyField
              label="Loan amount"
              id="loanAmount"
              value={shownLoanAmount}
              onChange={(value) => {
                setSource('loanAmount')
                setLoanAmount(value)
              }}
              hint="Enter any one of these three."
            />
          </div>

          {financing.depositExceedsPrice ? (
            <p className="text-destructive text-sm">
              The deposit is more than the purchase price, so there is nothing left to borrow.
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-4">
            <MoneyField
              label="Interest rate (%)"
              id="interestRate"
              value={interestRate}
              onChange={setInterestRate}
            />
            <MoneyField
              label="Term (years)"
              id="termYears"
              value={termYears}
              onChange={setTermYears}
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
            <MoneyField
              label="Offset balance"
              id="offsetBalance"
              value={offsetBalance}
              onChange={setOffsetBalance}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <MoneyField
              label="Other financing costs"
              id="otherCosts"
              value={otherCosts}
              onChange={setOtherCosts}
              hint="Lender fees not covered by the upfront costs list."
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
            hint={`over ${termYears || 0} years`}
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
