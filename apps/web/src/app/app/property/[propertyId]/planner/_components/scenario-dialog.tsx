'use client'

import type { PropertyScenario } from '@repo/database'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
} from '@repo/ui'
import { type ReactElement, useActionState, useEffect, useState } from 'react'
import { MoneyInput } from '../../../_components/money-input'
import { toMajorInput, toPercentInput } from '../../../_lib/format'
import type { ScenarioBase } from '../../../_lib/scenarios'
import { addScenario, updateScenario } from '../scenarios-actions'

/**
 * The form behind a scenario column.
 *
 * Every field is optional and every placeholder shows the base property's
 * current figure, so an empty box reads as "same as the property" rather than
 * "zero". That is the whole idea made visible: a scenario is the handful of
 * things it changes, not a second copy of the property.
 */

function PercentField({
  label,
  id,
  name,
  defaultValue,
  placeholder,
  error,
}: {
  label: string
  id: string
  name: string
  defaultValue: string
  placeholder: string
  error?: string[]
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        inputMode="decimal"
        defaultValue={defaultValue}
        placeholder={placeholder}
      />
      {error?.[0] ? <p className="text-destructive text-xs">{error[0]}</p> : null}
    </div>
  )
}

export function ScenarioDialog({
  propertyId,
  scenario,
  base,
  isLet,
  baseRent,
  locale,
  trigger,
}: {
  propertyId: string
  /** Omitted when adding. */
  scenario?: PropertyScenario
  /** The live working inputs, used for the placeholders. */
  base: ScenarioBase
  isLet: boolean
  /** Minor units, at the property's rent frequency. */
  baseRent: number | null
  locale: string
  trigger: ReactElement
}) {
  const action = scenario ? updateScenario : addScenario
  const [state, formAction, pending] = useActionState(action, null)
  const [open, setOpen] = useState(false)

  // Close once the action reports success. `useActionState` returns a fresh
  // object per submit, so this fires on every save rather than only the first.
  useEffect(() => {
    if (state?.ok) setOpen(false)
  }, [state])

  const overrides = scenario?.overrides ?? {}
  const errors = state?.errors

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{scenario ? 'Edit scenario' : 'Add scenario'}</DialogTitle>
          <DialogDescription>
            Fill in only what this scenario changes. Anything left blank keeps following the
            property, so editing the property updates this too.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4">
          {scenario ? (
            <input type="hidden" name="id" value={scenario.id} />
          ) : (
            <input type="hidden" name="propertyId" value={propertyId} />
          )}

          <div className="grid gap-1.5">
            <Label htmlFor="scenario-name">Name</Label>
            <Input
              id="scenario-name"
              name="name"
              defaultValue={scenario?.name ?? ''}
              placeholder="Stretch to 1.2m"
            />
            {errors?.name?.[0] ? (
              <p className="text-destructive text-xs">{errors.name[0]}</p>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <MoneyInput
              name="purchasePrice"
              id="scenario-purchasePrice"
              label="Purchase price"
              locale={locale}
              defaultValue={toMajorInput(overrides.purchasePrice ?? null)}
              placeholder={base.purchasePrice / 100}
              error={errors?.purchasePrice}
            />
            <MoneyInput
              name="estimatedMarketValue"
              id="scenario-estimatedMarketValue"
              label="Market value"
              locale={locale}
              defaultValue={toMajorInput(overrides.estimatedMarketValue ?? null)}
              placeholder={(base.estimatedMarketValue ?? base.purchasePrice) / 100}
              error={errors?.estimatedMarketValue}
            />
          </div>

          <fieldset className="grid gap-3 rounded-md border p-3 sm:grid-cols-3">
            <legend className="px-1 text-muted-foreground text-xs">
              Set one of these. If more than one is filled, the loan amount wins, then the deposit.
            </legend>
            <MoneyInput
              name="deposit"
              id="scenario-deposit"
              label="Deposit"
              locale={locale}
              defaultValue={toMajorInput(overrides.deposit ?? null)}
              placeholder={base.deposit / 100}
              error={errors?.deposit}
            />
            <PercentField
              label="Deposit %"
              id="scenario-depositPercentage"
              name="depositPercentage"
              defaultValue={
                overrides.depositPercentage === undefined
                  ? ''
                  : toPercentInput(overrides.depositPercentage)
              }
              placeholder={toPercentInput(base.depositPercentage)}
              error={errors?.depositPercentage}
            />
            <MoneyInput
              name="loanAmount"
              id="scenario-loanAmount"
              label="Loan amount"
              locale={locale}
              defaultValue={toMajorInput(overrides.loanAmount ?? null)}
              placeholder={base.loanAmount / 100}
              error={errors?.loanAmount}
            />
          </fieldset>

          <div className="grid gap-3 sm:grid-cols-3">
            <PercentField
              label="Interest rate"
              id="scenario-annualRate"
              name="annualRate"
              defaultValue={
                overrides.annualRate === undefined ? '' : toPercentInput(overrides.annualRate)
              }
              placeholder={toPercentInput(base.annualRate)}
              error={errors?.annualRate}
            />
            <div className="grid gap-1.5">
              <Label htmlFor="scenario-termYears">Term (years)</Label>
              <Input
                id="scenario-termYears"
                name="termYears"
                inputMode="numeric"
                defaultValue={overrides.termYears === undefined ? '' : String(overrides.termYears)}
                placeholder={String(base.termYears)}
              />
              {errors?.termYears?.[0] ? (
                <p className="text-destructive text-xs">{errors.termYears[0]}</p>
              ) : null}
            </div>
            {isLet ? (
              <MoneyInput
                name="rent"
                id="scenario-rent"
                label="Rent"
                locale={locale}
                defaultValue={toMajorInput(overrides.rent ?? null)}
                placeholder={baseRent === null ? undefined : baseRent / 100}
                error={errors?.rent}
              />
            ) : null}
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : scenario ? 'Save scenario' : 'Add scenario'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
