'use client'

import type { Jurisdiction } from '@repo/database'
import { PROPERTY_STATUSES, PROPERTY_TYPES, PROPERTY_USES } from '@repo/types'
import {
  Button,
  Card,
  CardContent,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui'
import { useActionState, useState } from 'react'
import type { ActionState } from '@/lib/action-state'
import { Field } from '../../../../banks/_components/form-field'
import { DateField } from '../../../_components/date-field'
import {
  PROPERTY_STATUS_LABELS,
  PROPERTY_TYPE_LABELS,
  PROPERTY_USE_LABELS,
} from '../../../_lib/labels'
import { type PlannerProperty, savePlannerDetails } from '../actions'

/** Sentinel for "no configured jurisdiction", since a Select cannot hold an empty value. */
const OTHER = '__other__'

function LabelledSelect({
  label,
  name,
  value,
  options,
  onValueChange,
}: {
  label: string
  name: string
  value: string
  options: Record<string, string>
  onValueChange: (value: string) => void
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Select
        name={name}
        value={value}
        items={options}
        onValueChange={(next) => next !== null && onValueChange(next)}
      >
        <SelectTrigger id={name}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(options).map(([optionValue, optionLabel]) => (
            <SelectItem key={optionValue} value={optionValue}>
              {optionLabel}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

/**
 * Property details.
 *
 * The jurisdiction decides which rules apply and what the purchase tax is
 * called, so it is the primary control here; country, region and currency
 * follow from it and only appear as inputs when no jurisdiction is chosen.
 */
export function DetailsPanel({
  property,
  jurisdictions,
}: {
  property: PlannerProperty
  jurisdictions: Jurisdiction[]
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    savePlannerDetails,
    null,
  )

  const [jurisdictionKey, setJurisdictionKey] = useState(property.jurisdictionKey ?? OTHER)
  const [type, setType] = useState<string>(property.type)
  const [intendedUse, setIntendedUse] = useState<string>(property.intendedUse)
  const [status, setStatus] = useState<string>(property.status)

  const usesJurisdiction = jurisdictionKey !== OTHER

  const jurisdictionOptions: Record<string, string> = {
    ...Object.fromEntries(jurisdictions.map((entry) => [entry.key, entry.name])),
    [OTHER]: 'Other (enter manually)',
  }

  return (
    <Card>
      <CardContent className="p-5">
        <form action={formAction} className="flex flex-col gap-5">
          <input type="hidden" name="id" value={property.id} />
          <input
            type="hidden"
            name="jurisdictionKey"
            value={usesJurisdiction ? jurisdictionKey : ''}
          />
          <input type="hidden" name="type" value={type} />
          <input type="hidden" name="intendedUse" value={intendedUse} />
          <input type="hidden" name="status" value={status} />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Name"
              name="name"
              defaultValue={state?.values?.name ?? property.name}
              error={state?.errors?.name}
            />
            <Field
              label="Address"
              name="address"
              defaultValue={state?.values?.address ?? property.address ?? ''}
              error={state?.errors?.address}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <LabelledSelect
              label="Jurisdiction"
              name="jurisdictionSelect"
              value={jurisdictionKey}
              options={jurisdictionOptions}
              onValueChange={setJurisdictionKey}
            />
            <LabelledSelect
              label="Property type"
              name="typeSelect"
              value={type}
              options={Object.fromEntries(
                PROPERTY_TYPES.map((value) => [value, PROPERTY_TYPE_LABELS[value]]),
              )}
              onValueChange={setType}
            />
          </div>

          {usesJurisdiction ? (
            <>
              <input type="hidden" name="country" value={property.country} />
              <input type="hidden" name="region" value={property.region ?? ''} />
              <input type="hidden" name="currency" value={property.currency} />
            </>
          ) : (
            <div className="grid gap-4 sm:grid-cols-3">
              <Field
                label="Country"
                name="country"
                defaultValue={state?.values?.country ?? property.country}
                error={state?.errors?.country}
              />
              <Field
                label="Region"
                name="region"
                defaultValue={state?.values?.region ?? property.region ?? ''}
                error={state?.errors?.region}
              />
              <Field
                label="Currency"
                name="currency"
                defaultValue={state?.values?.currency ?? property.currency}
                error={state?.errors?.currency}
              />
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <LabelledSelect
              label="Intended use"
              name="intendedUseSelect"
              value={intendedUse}
              options={Object.fromEntries(
                PROPERTY_USES.map((value) => [value, PROPERTY_USE_LABELS[value]]),
              )}
              onValueChange={setIntendedUse}
            />
            <LabelledSelect
              label="Status"
              name="statusSelect"
              value={status}
              options={Object.fromEntries(
                PROPERTY_STATUSES.map((value) => [value, PROPERTY_STATUS_LABELS[value]]),
              )}
              onValueChange={setStatus}
            />
            <DateField
              label="Purchase date"
              name="purchaseDate"
              defaultValue={state?.values?.purchaseDate ?? property.purchaseDate ?? ''}
              error={state?.errors?.purchaseDate}
            />
          </div>

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : 'Save details'}
            </Button>
            {state?.ok ? <span className="text-muted-foreground text-sm">Saved.</span> : null}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
