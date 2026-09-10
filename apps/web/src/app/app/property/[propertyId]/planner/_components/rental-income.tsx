'use client'

import type { PropertyRental } from '@repo/database'
import type { Frequency, PropertyCashFlow } from '@repo/property'
import { FREQUENCIES } from '@repo/property'
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
import { toMajorInput, toPercentInput } from '../../../_lib/format'
import { saveRental } from '../ongoing-actions'
import { FREQUENCY_LABELS } from './ongoing-costs'

function Line({
  label,
  value,
  tone,
  strong,
}: {
  label: string
  value: string
  tone?: 'negative' | 'muted'
  strong?: boolean
}) {
  return (
    <div
      className={
        strong ? 'flex justify-between border-t pt-2 font-semibold' : 'flex justify-between'
      }
    >
      <dt className={tone === 'muted' ? 'text-muted-foreground' : undefined}>{label}</dt>
      <dd className={tone === 'negative' ? 'text-destructive tabular-nums' : 'tabular-nums'}>
        {value}
      </dd>
    </div>
  )
}

/**
 * Rental income and the resulting cash flow.
 *
 * Cash flow is reported twice, before and after principal. Principal repayment
 * is not an expense (it buys equity) but it does leave the bank account, so
 * showing only one of the two misleads whichever way you pick.
 */
export function RentalIncome({
  propertyId,
  rental,
  cashFlow,
  currency,
  locale,
}: {
  propertyId: string
  rental: PropertyRental | undefined
  cashFlow: PropertyCashFlow | null
  currency: string
  locale: string
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(saveRental, null)

  return (
    <Card>
      <CardContent className="flex flex-col gap-6 p-5">
        <form action={formAction} className="grid gap-4 sm:grid-cols-4">
          <input type="hidden" name="propertyId" value={propertyId} />

          <MoneyInput
            label="Expected rent"
            name="rent"
            locale={locale}
            defaultValue={state?.values?.rent ?? toMajorInput(rental?.rent)}
            placeholder={600}
            error={state?.errors?.rent}
          />

          <div className="grid gap-1.5">
            <Label htmlFor="rentFrequency">Per</Label>
            <Select
              name="rentFrequency"
              defaultValue={rental?.rentFrequency ?? 'weekly'}
              items={FREQUENCY_LABELS}
            >
              <SelectTrigger id="rentFrequency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FREQUENCIES.map((frequency: Frequency) => (
                  <SelectItem key={frequency} value={frequency}>
                    {FREQUENCY_LABELS[frequency]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="vacancyRate">Vacancy (%)</Label>
            <Input
              id="vacancyRate"
              name="vacancyRate"
              inputMode="decimal"
              defaultValue={state?.values?.vacancyRate ?? toPercentInput(rental?.vacancyRate ?? 0)}
              placeholder="2"
            />
            {state?.errors?.vacancyRate?.[0] ? (
              <p className="text-destructive text-xs">{state.errors.vacancyRate[0]}</p>
            ) : null}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="managementRate">Management (%)</Label>
            <Input
              id="managementRate"
              name="managementRate"
              inputMode="decimal"
              defaultValue={
                state?.values?.managementRate ?? toPercentInput(rental?.managementRate ?? 0)
              }
              placeholder="7"
            />
            {state?.errors?.managementRate?.[0] ? (
              <p className="text-destructive text-xs">{state.errors.managementRate[0]}</p>
            ) : null}
          </div>

          <div className="flex items-center gap-3 sm:col-span-4">
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : 'Save rental'}
            </Button>
            {state?.ok ? <span className="text-muted-foreground text-sm">Saved.</span> : null}
          </div>
        </form>

        {cashFlow ? (
          <div className="grid gap-6 border-t pt-5 lg:grid-cols-2">
            <dl className="grid gap-2 text-sm">
              <Line
                label="Gross annual rent"
                value={formatMoney(cashFlow.grossAnnualRent, currency)}
              />
              <Line
                label="Less vacancy"
                value={`-${formatMoney(cashFlow.vacancyLoss, currency)}`}
                tone="muted"
              />
              <Line
                label="Less management"
                value={`-${formatMoney(cashFlow.managementFee, currency)}`}
                tone="muted"
              />
              <Line
                label="Less property costs"
                value={`-${formatMoney(
                  cashFlow.effectiveAnnualRent - cashFlow.netOperatingIncome,
                  currency,
                )}`}
                tone="muted"
              />
              <Line
                label="Net operating income"
                value={formatMoney(cashFlow.netOperatingIncome, currency)}
                strong
              />
            </dl>

            <dl className="grid gap-2 text-sm">
              <Line label="Gross yield" value={`${(cashFlow.grossYield * 100).toFixed(2)}%`} />
              <Line label="Net yield" value={`${(cashFlow.netYield * 100).toFixed(2)}%`} />
              <Line
                label="Cash flow before principal"
                value={formatMoney(cashFlow.annualCashFlowBeforePrincipal, currency)}
                tone={cashFlow.annualCashFlowBeforePrincipal < 0 ? 'negative' : undefined}
              />
              <Line
                label="Annual cash flow"
                value={formatMoney(cashFlow.annualCashFlow, currency)}
                tone={cashFlow.negative ? 'negative' : undefined}
                strong
              />
              <Line
                label="Monthly cash flow"
                value={formatMoney(cashFlow.monthlyCashFlow, currency)}
                tone={cashFlow.negative ? 'negative' : undefined}
              />
              <p className="text-muted-foreground text-xs">
                Net yield is measured before financing. Annual cash flow includes the principal you
                repay, which is not an expense but does leave your account.
              </p>
            </dl>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
