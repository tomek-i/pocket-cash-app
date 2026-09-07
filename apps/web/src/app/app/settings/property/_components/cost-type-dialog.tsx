'use client'

import type { CostType } from '@repo/database'
import {
  CALCULATION_BASES,
  CALCULATION_TYPES,
  type CalculationType,
  FREQUENCIES,
} from '@repo/property'
import { DEFAULT_COST_CATEGORIES } from '@repo/property/defaults'
import { COST_SCOPES, type CostScope } from '@repo/types'
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui'
import { ChevronDown } from 'lucide-react'
import { type ReactElement, useActionState, useEffect, useState } from 'react'
import type { ActionState } from '@/lib/action-state'
import { MoneyInput } from '../../../property/_components/money-input'
import { toMajorInput, toPercentInput } from '../../../property/_lib/format'
import { FREQUENCY_LABELS } from '../../../property/[propertyId]/planner/_components/ongoing-costs'
import { createCostType, updateCostType } from '../actions'

const SCOPE_LABELS: Record<CostScope, string> = {
  upfront: 'Upfront (paid to buy)',
  recurring: 'Ongoing (paid to hold)',
}

const CALCULATION_TYPE_LABELS: Record<CalculationType, string> = {
  fixed: 'Fixed amount',
  percentage: 'Percentage of a value',
  formula: 'Formula',
  bracketed: 'Rate schedule (brackets)',
  manual: 'Entered per property',
}

const BASE_LABELS: Record<string, string> = {
  purchasePrice: 'Purchase price',
  propertyValue: 'Property value',
  loanAmount: 'Loan amount',
  deposit: 'Deposit',
  dutiableValue: 'Dutiable value',
}

const CATEGORY_LABELS = Object.fromEntries(
  DEFAULT_COST_CATEGORIES.map((category) => [category.id, category.name]),
)

function LabelledSelect({
  label,
  id,
  value,
  options,
  onValueChange,
}: {
  label: string
  id: string
  value: string
  options: Record<string, string>
  onValueChange: (value: string) => void
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select
        value={value}
        items={options}
        onValueChange={(next) => next !== null && onValueChange(next)}
      >
        <SelectTrigger id={id}>
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
 * Create or edit a cost type.
 *
 * Name and default amount are the whole form until the user asks for more.
 * Everything that makes a cost calculated rather than fixed sits behind
 * "Advanced", because the common case is "Solar Inspection, $250" and that has
 * to stay a two-field job.
 */
export function CostTypeDialog({
  costType,
  locale,
  trigger,
}: {
  costType?: CostType
  locale: string
  trigger: ReactElement
}) {
  const action = costType ? updateCostType : createCostType
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, null)
  const [open, setOpen] = useState(false)
  const [advanced, setAdvanced] = useState(false)

  const [scope, setScope] = useState<string>(costType?.scope ?? 'upfront')
  const [calculationType, setCalculationType] = useState<string>(
    costType?.calculationType ?? 'fixed',
  )
  const [category, setCategory] = useState<string>(costType?.category ?? 'other')
  const [calculationBase, setCalculationBase] = useState<string>(
    costType?.calculationBase ?? 'purchasePrice',
  )
  const [frequency, setFrequency] = useState<string>(costType?.defaultFrequency ?? 'monthly')

  useEffect(() => {
    if (state?.ok) setOpen(false)
  }, [state])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{costType ? 'Edit cost' : 'Add a cost type'}</DialogTitle>
        </DialogHeader>

        <form action={formAction} className="grid gap-4">
          {costType ? <input type="hidden" name="id" value={costType.id} /> : null}
          <input type="hidden" name="scope" value={scope} />
          <input type="hidden" name="calculationType" value={calculationType} />
          <input type="hidden" name="category" value={category} />
          <input
            type="hidden"
            name="calculationBase"
            value={
              calculationType === 'percentage' || calculationType === 'bracketed'
                ? calculationBase
                : ''
            }
          />
          <input
            type="hidden"
            name="defaultFrequency"
            value={scope === 'recurring' ? frequency : ''}
          />

          <div className="grid gap-1.5">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              name="name"
              defaultValue={state?.values?.name ?? costType?.name ?? ''}
              placeholder="Solar Inspection"
            />
            {state?.errors?.name?.[0] ? (
              <p className="text-destructive text-xs">{state.errors.name[0]}</p>
            ) : null}
          </div>

          <MoneyInput
            label="Default value"
            name="defaultValue"
            locale={locale}
            defaultValue={state?.values?.defaultValue ?? toMajorInput(costType?.defaultValue)}
            placeholder={250}
            error={state?.errors?.defaultValue}
          />

          <button
            type="button"
            onClick={() => setAdvanced((open) => !open)}
            className="flex w-fit items-center gap-1.5 text-muted-foreground text-sm hover:text-foreground"
          >
            <ChevronDown className={advanced ? 'size-4 rotate-180' : 'size-4'} />
            Advanced
          </button>

          {advanced ? (
            <div className="grid gap-4 rounded-lg border p-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <LabelledSelect
                  label="When it is paid"
                  id="scope"
                  value={scope}
                  options={Object.fromEntries(
                    COST_SCOPES.map((value) => [value, SCOPE_LABELS[value]]),
                  )}
                  onValueChange={setScope}
                />
                <LabelledSelect
                  label="Category"
                  id="category"
                  value={category}
                  options={CATEGORY_LABELS}
                  onValueChange={setCategory}
                />
              </div>

              <LabelledSelect
                label="How it is calculated"
                id="calculationType"
                value={calculationType}
                options={Object.fromEntries(
                  CALCULATION_TYPES.map((value) => [value, CALCULATION_TYPE_LABELS[value]]),
                )}
                onValueChange={setCalculationType}
              />

              {calculationType === 'percentage' ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label htmlFor="percentage">Percentage</Label>
                    <Input
                      id="percentage"
                      name="percentage"
                      inputMode="decimal"
                      defaultValue={
                        state?.values?.percentage ?? toPercentInput(costType?.percentage)
                      }
                      placeholder="1.2"
                    />
                    {state?.errors?.percentage?.[0] ? (
                      <p className="text-destructive text-xs">{state.errors.percentage[0]}</p>
                    ) : null}
                  </div>
                  <LabelledSelect
                    label="Of"
                    id="calculationBase"
                    value={calculationBase}
                    options={Object.fromEntries(
                      CALCULATION_BASES.map((value) => [value, BASE_LABELS[value] ?? value]),
                    )}
                    onValueChange={setCalculationBase}
                  />
                </div>
              ) : null}

              {calculationType === 'bracketed' ? (
                <LabelledSelect
                  label="Calculated on"
                  id="calculationBase"
                  value={calculationBase}
                  options={Object.fromEntries(
                    CALCULATION_BASES.map((value) => [value, BASE_LABELS[value] ?? value]),
                  )}
                  onValueChange={setCalculationBase}
                />
              ) : null}

              {calculationType === 'formula' ? (
                <div className="grid gap-1.5">
                  <Label htmlFor="formula">Formula</Label>
                  <Input
                    id="formula"
                    name="formula"
                    defaultValue={state?.values?.formula ?? costType?.formula ?? ''}
                    placeholder="loanAmount * 0.005"
                  />
                  <p className="text-muted-foreground text-xs">
                    Use purchasePrice, propertyValue, loanAmount, deposit, dutiableValue, lvr or
                    interestRate, with + - * / and min() or max().
                  </p>
                  {state?.errors?.formula?.[0] ? (
                    <p className="text-destructive text-xs">{state.errors.formula[0]}</p>
                  ) : null}
                </div>
              ) : null}

              {scope === 'recurring' ? (
                <LabelledSelect
                  label="Usual frequency"
                  id="defaultFrequency"
                  value={frequency}
                  options={Object.fromEntries(
                    FREQUENCIES.map((value) => [value, FREQUENCY_LABELS[value]]),
                  )}
                  onValueChange={setFrequency}
                />
              ) : null}

              <div className="grid gap-1.5">
                <Label htmlFor="notes">Notes</Label>
                <Input
                  id="notes"
                  name="notes"
                  defaultValue={state?.values?.notes ?? costType?.notes ?? ''}
                />
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : costType ? 'Save changes' : 'Add cost type'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
