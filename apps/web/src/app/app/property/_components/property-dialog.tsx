'use client'

import type { Jurisdiction } from '@repo/database'
import { LOAN_TYPES } from '@repo/property'
import { PROPERTY_STATUSES, PROPERTY_TYPES, PROPERTY_USES } from '@repo/types'
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Label,
  ScrollArea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui'
import { type ReactElement, useActionState, useEffect, useState } from 'react'
import type { ActionState } from '@/lib/action-state'
import { Field } from '../../banks/_components/form-field'
import { toMajorInput, toPercentInput } from '../_lib/format'
import {
  LOAN_TYPE_LABELS,
  PROPERTY_STATUS_LABELS,
  PROPERTY_TYPE_LABELS,
  PROPERTY_USE_LABELS,
} from '../_lib/labels'
import { createProperty, type PropertyWithLoans, updateProperty } from '../actions'
import { DateField } from './date-field'
import { MoneyInput } from './money-input'

/** Sentinel for "no configured jurisdiction", since a Select cannot hold an empty value. */
const OTHER = '__other__'

function LabelledSelect({
  label,
  name,
  defaultValue,
  options,
  onValueChange,
}: {
  label: string
  name: string
  defaultValue: string
  options: { value: string; label: string }[]
  onValueChange?: (value: string) => void
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Select
        name={name}
        defaultValue={defaultValue}
        // `items` maps each stored value to its label. Without it the trigger
        // renders the raw value, so the user sees "ownerOccupied" instead of
        // "Owner occupied".
        items={Object.fromEntries(options.map((option) => [option.value, option.label]))}
        // The Select can report null when a value is cleared; these are all
        // fixed option lists, so there is nothing to do in that case.
        onValueChange={
          onValueChange ? (value) => (value === null ? undefined : onValueChange(value)) : undefined
        }
      >
        <SelectTrigger id={name}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export function PropertyDialog({
  property,
  jurisdictions,
  defaultCurrency = 'USD',
  locale,
  trigger,
}: {
  property?: PropertyWithLoans
  jurisdictions: Jurisdiction[]
  defaultCurrency?: string
  /** How amounts are grouped. Resolved on the server from the machine or the setting. */
  locale: string
  trigger: ReactElement
}) {
  const action = property ? updateProperty : createProperty
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, null)
  const [open, setOpen] = useState(false)

  // A new property starts on the first configured jurisdiction, since that is
  // almost always the one wanted. An existing property keeps what it was saved
  // with, including "other" when it was saved without one.
  const initialJurisdiction =
    state?.values?.jurisdictionKey ||
    (property ? (property.jurisdictionKey ?? OTHER) : (jurisdictions[0]?.key ?? OTHER))
  const [jurisdictionKey, setJurisdictionKey] = useState(initialJurisdiction)
  const initialStatus = state?.values?.status ?? property?.status ?? 'planned'

  useEffect(() => {
    if (state?.ok) setOpen(false)
  }, [state])

  // A configured jurisdiction supplies country, region and currency, so those
  // inputs only appear when there is nothing to supply them.
  const usesJurisdiction = jurisdictionKey !== OTHER
  const loan = property?.loans[0]

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{property ? 'Edit property' : 'Add property'}</DialogTitle>
        </DialogHeader>

        <form action={formAction} className="grid gap-5">
          {/* Only the fields scroll: the title and the submit button stay put,
              which is what makes a long form usable. */}
          <ScrollArea className="max-h-[62vh]">
            <div className="grid gap-5 pr-4">
              {property ? <input type="hidden" name="id" value={property.id} /> : null}
              {/* The Select holds a sentinel; the action wants an empty string. */}
              <input
                type="hidden"
                name="jurisdictionKey"
                value={usesJurisdiction ? jurisdictionKey : ''}
              />

              <div className="grid gap-4">
                <Field
                  label="Name"
                  name="name"
                  defaultValue={state?.values?.name ?? property?.name ?? ''}
                  placeholder="12 Example Street"
                  error={state?.errors?.name}
                />
                <Field
                  label="Address"
                  name="address"
                  defaultValue={state?.values?.address ?? property?.address ?? ''}
                  placeholder="Suburb, State, Postcode"
                  error={state?.errors?.address}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <LabelledSelect
                  label="Jurisdiction"
                  name="jurisdictionSelect"
                  defaultValue={initialJurisdiction}
                  onValueChange={setJurisdictionKey}
                  options={[
                    ...jurisdictions.map((j) => ({ value: j.key, label: j.name })),
                    { value: OTHER, label: 'Other (enter manually)' },
                  ]}
                />
                <LabelledSelect
                  label="Property type"
                  name="type"
                  defaultValue={state?.values?.type ?? property?.type ?? 'house'}
                  options={PROPERTY_TYPES.map((value) => ({
                    value,
                    label: PROPERTY_TYPE_LABELS[value],
                  }))}
                />
              </div>

              {usesJurisdiction ? null : (
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field
                    label="Country"
                    name="country"
                    defaultValue={state?.values?.country ?? property?.country ?? ''}
                    placeholder="AU"
                    error={state?.errors?.country}
                  />
                  <Field
                    label="Region"
                    name="region"
                    defaultValue={state?.values?.region ?? property?.region ?? ''}
                    placeholder="NSW"
                    error={state?.errors?.region}
                  />
                  <Field
                    label="Currency"
                    name="currency"
                    defaultValue={state?.values?.currency ?? property?.currency ?? defaultCurrency}
                    placeholder="AUD"
                    error={state?.errors?.currency}
                  />
                </div>
              )}
              {usesJurisdiction ? (
                <>
                  {/* The jurisdiction supplies these, but the schema still requires
                  them, so they travel as hidden fields and the action overwrites
                  them from the jurisdiction record. */}
                  <input type="hidden" name="country" value={property?.country || 'AU'} />
                  <input type="hidden" name="region" value={property?.region ?? ''} />
                  <input
                    type="hidden"
                    name="currency"
                    value={property?.currency || defaultCurrency}
                  />
                </>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <LabelledSelect
                  label="Intended use"
                  name="intendedUse"
                  defaultValue={
                    state?.values?.intendedUse ?? property?.intendedUse ?? 'ownerOccupied'
                  }
                  options={PROPERTY_USES.map((value) => ({
                    value,
                    label: PROPERTY_USE_LABELS[value],
                  }))}
                />
                <LabelledSelect
                  label="Status"
                  name="status"
                  defaultValue={initialStatus}
                  options={PROPERTY_STATUSES.map((value) => ({
                    value,
                    label: PROPERTY_STATUS_LABELS[value],
                  }))}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <MoneyInput
                  label="Purchase price"
                  name="purchasePrice"
                  help="What you are paying, or what you paid for a property you already own. Transfer duty and the other government charges are calculated from this figure, so on a planned purchase it drives the cash you need at settlement."
                  locale={locale}
                  defaultValue={
                    state?.values?.purchasePrice ?? toMajorInput(property?.purchasePrice)
                  }
                  placeholder={950000}
                  error={state?.errors?.purchasePrice}
                />
                <MoneyInput
                  label="Market value"
                  name="marketValue"
                  help="What it would sell for today, from a valuation, an agent appraisal or recent sales nearby. Not a forecast: nothing here projects future value. Deliberately not the price you are paying, because the gap between the two is what tells you whether you are overpaying, and LVR and equity measure against this. Leave it blank to use the purchase price."
                  locale={locale}
                  defaultValue={state?.values?.marketValue ?? toMajorInput(property?.marketValue)}
                  placeholder={980000}
                  error={state?.errors?.marketValue}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Ownership share (%)"
                  name="ownershipShare"
                  help="The share of it you own. Portfolio totals count value, debt and equity at this share, so a half share of a $1,000,000 property with an $800,000 loan counts as $500,000 of value and $400,000 of debt. LVR is unaffected, since the share applies to both sides."
                  defaultValue={
                    state?.values?.ownershipShare ?? toPercentInput(property?.ownershipShare ?? 1)
                  }
                  placeholder="100"
                  error={state?.errors?.ownershipShare}
                />
                <DateField
                  label="Purchase date"
                  name="purchaseDate"
                  defaultValue={state?.values?.purchaseDate ?? property?.purchaseDate ?? ''}
                  error={state?.errors?.purchaseDate}
                />
              </div>

              <div className="grid gap-3 rounded-lg border p-4">
                <p className="font-medium text-sm">Loan</p>
                <div className="grid gap-4 sm:grid-cols-3">
                  <MoneyInput
                    label="Loan amount"
                    name="loanAmount"
                    locale={locale}
                    defaultValue={state?.values?.loanAmount ?? toMajorInput(loan?.loanAmount)}
                    placeholder={760000}
                    error={state?.errors?.loanAmount}
                  />
                  <Field
                    label="Interest rate (%)"
                    name="interestRate"
                    defaultValue={state?.values?.interestRate ?? toPercentInput(loan?.annualRate)}
                    placeholder="6.25"
                    error={state?.errors?.interestRate}
                  />
                  <Field
                    label="Term (years)"
                    name="loanTermYears"
                    defaultValue={
                      state?.values?.loanTermYears ?? (loan ? String(loan.termYears) : '')
                    }
                    placeholder="30"
                    error={state?.errors?.loanTermYears}
                  />
                </div>
                <LabelledSelect
                  label="Loan type"
                  name="loanType"
                  defaultValue={state?.values?.loanType ?? loan?.loanType ?? 'principalAndInterest'}
                  options={LOAN_TYPES.map((value) => ({ value, label: LOAN_TYPE_LABELS[value] }))}
                />
              </div>
            </div>
          </ScrollArea>

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : property ? 'Save changes' : 'Add property'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
