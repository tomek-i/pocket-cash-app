'use client'

import type { CostType } from '@repo/database'
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
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui'
import { Plus, TriangleAlert } from 'lucide-react'
import { useActionState, useEffect, useState } from 'react'
import { formatMoney } from '@/lib/money'
import type { UpfrontCostsSummary } from '../../../_lib/costs'
import { addPropertyCost } from '../costs-actions'
import { CostRow } from './cost-row'

/**
 * The Add Cost selector.
 *
 * Options come from the database, so a cost type a user creates in settings
 * appears here with no code change. That is the point of the cost type system:
 * adding "Solar Inspection, $250" must never need a developer.
 */
function AddCostDialog({
  propertyId,
  costTypes,
  categoryNames,
  alreadyAdded,
}: {
  propertyId: string
  costTypes: CostType[]
  categoryNames: Record<string, string>
  alreadyAdded: Set<string>
}) {
  const [state, formAction, pending] = useActionState(addPropertyCost, null)
  const [open, setOpen] = useState(false)
  const available = costTypes.filter((type) => !alreadyAdded.has(type.id))
  const [selected, setSelected] = useState(available[0]?.id ?? '')

  useEffect(() => {
    if (state?.ok) setOpen(false)
  }, [state])

  const grouped = available.reduce<Record<string, CostType[]>>((groups, type) => {
    const key = type.category
    groups[key] = groups[key] ?? []
    groups[key].push(type)
    return groups
  }, {})

  const labels = Object.fromEntries(available.map((type) => [type.id, type.name]))

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
          <DialogTitle>Add a cost</DialogTitle>
        </DialogHeader>

        {available.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Every configured cost is already on this property. Create more in Settings.
          </p>
        ) : (
          <form action={formAction} className="grid gap-4">
            <input type="hidden" name="propertyId" value={propertyId} />
            <input type="hidden" name="costTypeId" value={selected} />
            <div className="grid gap-1.5">
              <Label htmlFor="costType">Cost</Label>
              <Select
                value={selected}
                items={labels}
                onValueChange={(value) => value !== null && setSelected(value)}
              >
                <SelectTrigger id="costType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(grouped).map(([category, types]) => (
                    <div key={category}>
                      <p className="px-2 py-1.5 font-medium text-muted-foreground text-xs">
                        {categoryNames[category] ?? category}
                      </p>
                      {types.map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.name}
                        </SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={pending || !selected}>
                {pending ? 'Adding…' : 'Add cost'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

export function UpfrontCosts({
  propertyId,
  summary,
  costTypes,
  categoryNames,
  currency,
  locale,
  purchasePrice,
  loanAmount,
}: {
  propertyId: string
  summary: UpfrontCostsSummary
  costTypes: CostType[]
  categoryNames: Record<string, string>
  currency: string
  locale: string
  purchasePrice: number
  loanAmount: number
}) {
  const alreadyAdded = new Set(summary.costs.map((entry) => entry.row.costTypeId))

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-muted-foreground text-sm">
            {summary.costs.length} cost{summary.costs.length === 1 ? '' : 's'}
          </p>
          <AddCostDialog
            propertyId={propertyId}
            costTypes={costTypes}
            categoryNames={categoryNames}
            alreadyAdded={alreadyAdded}
          />
        </div>

        {/*
          A cost the engine could not work out contributes zero to the total and
          would otherwise say so nowhere: a jurisdiction with no rate schedule
          showed an upfront total and a cash required that quietly omitted the
          largest charge in the purchase, both presented as settled figures. The
          engine already collects these; this reads them.
        */}
        {summary.errors.length > 0 ? (
          <div className="flex gap-2.5 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
            <div>
              <p className="font-medium">
                {summary.errors.length} cost{summary.errors.length === 1 ? '' : 's'} could not be
                calculated, and {summary.errors.length === 1 ? 'is' : 'are'} counted as zero
              </p>
              <ul className="mt-1 list-none space-y-0.5 p-0 text-muted-foreground">
                {summary.errors.map((cost) => (
                  <li key={cost.id}>
                    {cost.name}: {cost.error?.message ?? 'unknown problem'}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}

        {summary.costs.length === 0 ? (
          <p className="py-6 text-center text-muted-foreground text-sm">
            No costs yet. Add the ones that apply to this purchase.
          </p>
        ) : (
          <div className="flex flex-col border-t">
            {summary.costs.map((entry) => (
              <CostRow key={entry.row.id} entry={entry} currency={currency} locale={locale} />
            ))}
          </div>
        )}

        <dl className="grid gap-2 border-t pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Purchase price</dt>
            <dd className="tabular-nums">{formatMoney(purchasePrice, currency)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Total upfront costs</dt>
            <dd className="tabular-nums">{formatMoney(summary.total, currency)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Less loan</dt>
            <dd className="tabular-nums">-{formatMoney(loanAmount, currency)}</dd>
          </div>
          <div className="flex justify-between border-t pt-2 font-semibold">
            <dt>Total cash required</dt>
            <dd className="tabular-nums">{formatMoney(summary.cashRequired, currency)}</dd>
          </div>
          <p className="text-muted-foreground text-xs">
            The deposit of {formatMoney(summary.deposit, currency)} is the price less the loan, so
            it is already inside this figure.
          </p>
        </dl>
      </CardContent>
    </Card>
  )
}
