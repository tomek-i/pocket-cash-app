'use client'

import type { CostType } from '@repo/database'
import { FREQUENCIES, type Frequency } from '@repo/property'
import {
  Button,
  Card,
  CardContent,
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
import { Plus, Trash2 } from 'lucide-react'
import { useActionState, useEffect, useState } from 'react'
import { formatMoney } from '@/lib/money'
import { toMajorInput } from '../../../_lib/format'
import type { NormalisedRecurringCost, RecurringCostsSummary } from '../../../_lib/ongoing'
import {
  addRecurringCost,
  removeRecurringCost,
  toggleRecurringCost,
  updateRecurringCost,
} from '../ongoing-actions'

/** How often a cost is charged, for the frequency pickers. */
export const FREQUENCY_LABELS: Record<Frequency, string> = {
  weekly: 'Weekly',
  fortnightly: 'Fortnightly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  halfYearly: 'Half-yearly',
  annual: 'Annual',
  custom: 'Custom',
}

function FrequencySelect({
  id,
  name,
  value,
  onValueChange,
}: {
  id: string
  name: string
  value: Frequency
  onValueChange?: (value: Frequency) => void
}) {
  return (
    <Select
      name={name}
      value={value}
      items={FREQUENCY_LABELS}
      onValueChange={(next) => next !== null && onValueChange?.(next as Frequency)}
    >
      <SelectTrigger id={id} className="h-8">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {FREQUENCIES.map((frequency) => (
          <SelectItem key={frequency} value={frequency}>
            {FREQUENCY_LABELS[frequency]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function AddRecurringCostDialog({
  propertyId,
  costTypes,
}: {
  propertyId: string
  costTypes: CostType[]
}) {
  const [state, formAction, pending] = useActionState(addRecurringCost, null)
  const [open, setOpen] = useState(false)
  const [selectedId, setSelectedId] = useState(costTypes[0]?.id ?? '')

  useEffect(() => {
    if (state?.ok) setOpen(false)
  }, [state])

  const selected = costTypes.find((type) => type.id === selectedId)
  const labels = Object.fromEntries(costTypes.map((type) => [type.id, type.name]))

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" className="gap-1.5">
            <Plus className="size-4" />
            Add cost
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add an ongoing cost</DialogTitle>
        </DialogHeader>
        {/* Picking a catalogue entry fills the name, amount and cadence in; all
            three stay editable, since a holding cost is usually a real bill the
            user already knows the size of. */}
        <form action={formAction} className="grid gap-4" key={selectedId}>
          <input type="hidden" name="propertyId" value={propertyId} />
          <input type="hidden" name="costTypeId" value={selectedId} />
          <input type="hidden" name="category" value={selected?.category ?? 'other'} />

          <div className="grid gap-1.5">
            <Label htmlFor="catalogue">Start from</Label>
            <Select
              value={selectedId}
              items={labels}
              onValueChange={(value) => value !== null && setSelectedId(value)}
            >
              <SelectTrigger id="catalogue">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {costTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" defaultValue={selected?.name ?? ''} />
            {state?.errors?.name?.[0] ? (
              <p className="text-destructive text-xs">{state.errors.name[0]}</p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                name="amount"
                inputMode="decimal"
                defaultValue={toMajorInput(selected?.defaultValue)}
              />
              {state?.errors?.amount?.[0] ? (
                <p className="text-destructive text-xs">{state.errors.amount[0]}</p>
              ) : null}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="frequency">Frequency</Label>
              <FrequencySelect
                id="frequency"
                name="frequency"
                value={selected?.defaultFrequency ?? 'monthly'}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? 'Adding…' : 'Add cost'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function RecurringCostRow({ cost, currency }: { cost: NormalisedRecurringCost; currency: string }) {
  const { row } = cost
  const [, updateAction, updating] = useActionState(updateRecurringCost, null)
  const [, toggleAction] = useActionState(toggleRecurringCost, null)
  const [, removeAction] = useActionState(removeRecurringCost, null)
  const [amount, setAmount] = useState(toMajorInput(row.amount))
  const [frequency, setFrequency] = useState<Frequency>(row.frequency)

  return (
    <div
      className={
        row.enabled ? 'border-b py-3 last:border-b-0' : 'border-b py-3 opacity-55 last:border-b-0'
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <form action={toggleAction}>
            <input type="hidden" name="id" value={row.id} />
            <input type="hidden" name="enabled" value={row.enabled ? 'false' : 'true'} />
            <button
              type="submit"
              aria-label={row.enabled ? `Disable ${row.name}` : `Enable ${row.name}`}
              className={
                row.enabled
                  ? 'flex size-4 items-center justify-center rounded border border-primary bg-primary text-[10px] text-primary-foreground'
                  : 'size-4 rounded border border-input'
              }
            >
              {row.enabled ? '✓' : ''}
            </button>
          </form>
          <p className="font-medium">{row.name}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <form action={updateAction} className="flex items-center gap-2">
            <input type="hidden" name="id" value={row.id} />
            <Input
              name="amount"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              inputMode="decimal"
              className="h-8 w-28"
              aria-label={`${row.name} amount`}
            />
            <div className="w-36">
              <FrequencySelect
                id={`frequency-${row.id}`}
                name="frequency"
                value={frequency}
                onValueChange={setFrequency}
              />
            </div>
            <Button type="submit" size="sm" variant="secondary" disabled={updating}>
              {updating ? 'Saving…' : 'Save'}
            </Button>
          </form>

          <p className="w-28 text-right text-muted-foreground text-sm tabular-nums">
            {formatMoney(cost.monthly, currency)}/mo
          </p>

          <form action={removeAction}>
            <input type="hidden" name="id" value={row.id} />
            <Button type="submit" variant="ghost" size="icon" aria-label={`Remove ${row.name}`}>
              <Trash2 className="size-4" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}

export function OngoingCosts({
  propertyId,
  summary,
  costTypes,
  currency,
}: {
  propertyId: string
  summary: RecurringCostsSummary
  costTypes: CostType[]
  currency: string
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-muted-foreground text-sm">
            {summary.costs.length} cost{summary.costs.length === 1 ? '' : 's'}
          </p>
          <AddRecurringCostDialog propertyId={propertyId} costTypes={costTypes} />
        </div>

        {summary.costs.length === 0 ? (
          <p className="py-6 text-center text-muted-foreground text-sm">
            No ongoing costs yet. Add rates, insurance, strata and anything else you pay to hold the
            property.
          </p>
        ) : (
          <div className="flex flex-col border-t">
            {summary.costs.map((cost) => (
              <RecurringCostRow key={cost.row.id} cost={cost} currency={currency} />
            ))}
          </div>
        )}

        <dl className="grid gap-2 border-t pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Total monthly</dt>
            <dd className="tabular-nums">{formatMoney(summary.monthly, currency)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Total annual</dt>
            <dd className="tabular-nums">{formatMoney(summary.annual, currency)}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  )
}
