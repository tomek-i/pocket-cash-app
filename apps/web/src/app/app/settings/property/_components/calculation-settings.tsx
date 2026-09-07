'use client'

import type { PropertySettings } from '@repo/database'
import { Button, Card, CardContent } from '@repo/ui'
import { useActionState } from 'react'
import type { ActionState } from '@/lib/action-state'
import { Field } from '../../../banks/_components/form-field'
import { toPercentInput } from '../../../property/_lib/format'
import { savePropertySettings } from '../actions'

/** Decimal rates to the comma-separated percentage list the field edits. */
function ratesToInput(rates: number[]): string {
  return rates.map((rate) => toPercentInput(rate)).join(', ')
}

/**
 * Defaults applied to a new property, and the rate list the sensitivity table
 * uses. Nothing here changes an existing property; these are starting values.
 */
export function CalculationSettings({ settings }: { settings: Required<PropertySettings> }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    savePropertySettings,
    null,
  )

  return (
    <Card>
      <CardContent className="p-5">
        <form action={formAction} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field
              label="Loan term (years)"
              name="defaultLoanTermYears"
              defaultValue={
                state?.values?.defaultLoanTermYears ?? String(settings.defaultLoanTermYears)
              }
              error={state?.errors?.defaultLoanTermYears}
            />
            <Field
              label="Interest rate (%)"
              name="defaultInterestRate"
              defaultValue={
                state?.values?.defaultInterestRate ?? toPercentInput(settings.defaultInterestRate)
              }
              error={state?.errors?.defaultInterestRate}
            />
            <Field
              label="Deposit (%)"
              name="defaultDepositPercentage"
              defaultValue={
                state?.values?.defaultDepositPercentage ??
                toPercentInput(settings.defaultDepositPercentage)
              }
              error={state?.errors?.defaultDepositPercentage}
            />
            <Field
              label="Vacancy (%)"
              name="defaultVacancyRate"
              defaultValue={
                state?.values?.defaultVacancyRate ?? toPercentInput(settings.defaultVacancyRate)
              }
              error={state?.errors?.defaultVacancyRate}
            />
            <Field
              label="Management (%)"
              name="defaultManagementRate"
              defaultValue={
                state?.values?.defaultManagementRate ??
                toPercentInput(settings.defaultManagementRate)
              }
              error={state?.errors?.defaultManagementRate}
            />
            <Field
              label="Sensitivity rates (%)"
              name="sensitivityRates"
              defaultValue={
                state?.values?.sensitivityRates ?? ratesToInput(settings.sensitivityRates)
              }
              placeholder="4, 5, 6, 7, 8"
              error={state?.errors?.sensitivityRates}
            />
          </div>

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : 'Save defaults'}
            </Button>
            {state?.ok ? <span className="text-muted-foreground text-sm">Saved.</span> : null}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
