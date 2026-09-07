'use client'

import type { CostType } from '@repo/database'
import { Badge, Button, Card, CardContent } from '@repo/ui'
import { Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useActionState } from 'react'
import { formatMoney } from '@/lib/money'
import { toPercentInput } from '../../../property/_lib/format'
import { deleteCostType, restoreCostTypeDefault, toggleCostType } from '../actions'
import { CostTypeDialog } from './cost-type-dialog'

/** A one-line description of how a cost works out its amount. */
function describe(costType: CostType, currency: string): string {
  switch (costType.calculationType) {
    case 'fixed':
      return costType.defaultValue === null
        ? 'Fixed amount'
        : formatMoney(costType.defaultValue, currency)
    case 'percentage':
      return `${toPercentInput(costType.percentage)}% of ${costType.calculationBase ?? 'purchase price'}`
    case 'formula':
      return costType.formula ?? 'Formula'
    case 'bracketed':
      return 'From a rate schedule'
    default:
      return 'Entered per property'
  }
}

function CostTypeRow({
  costType,
  currency,
  locale,
}: {
  costType: CostType
  currency: string
  locale: string
}) {
  const [, toggleAction] = useActionState(toggleCostType, null)
  const [, deleteAction] = useActionState(deleteCostType, null)
  const [, restoreAction] = useActionState(restoreCostTypeDefault, null)

  const removed = costType.deletedAt !== null

  return (
    <div
      className={
        costType.enabled && !removed
          ? 'flex flex-wrap items-center justify-between gap-3 border-b py-3 last:border-b-0'
          : 'flex flex-wrap items-center justify-between gap-3 border-b py-3 opacity-55 last:border-b-0'
      }
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium">{costType.name}</p>
          {costType.isSystem ? (
            <Badge variant="outline" className="text-[10px]">
              Built in
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-[10px]">
              Custom
            </Badge>
          )}
          {removed ? (
            <Badge variant="outline" className="text-[10px]">
              Removed
            </Badge>
          ) : null}
        </div>
        <p className="text-muted-foreground text-xs">{describe(costType, currency)}</p>
      </div>

      <div className="flex items-center gap-1">
        {!removed ? (
          <form action={toggleAction}>
            <input type="hidden" name="id" value={costType.id} />
            <input type="hidden" name="enabled" value={costType.enabled ? 'false' : 'true'} />
            <Button type="submit" variant="ghost" size="sm">
              {costType.enabled ? 'Disable' : 'Enable'}
            </Button>
          </form>
        ) : null}

        {costType.isSystem ? (
          <form action={restoreAction}>
            <input type="hidden" name="id" value={costType.id} />
            <Button
              type="submit"
              variant="ghost"
              size="icon"
              aria-label={`Restore ${costType.name} to the shipped default`}
              title="Restore the shipped default"
            >
              <RotateCcw className="size-4" />
            </Button>
          </form>
        ) : null}

        <CostTypeDialog
          costType={costType}
          locale={locale}
          trigger={
            <Button variant="ghost" size="icon" aria-label={`Edit ${costType.name}`}>
              <Pencil className="size-4" />
            </Button>
          }
        />

        {!removed ? (
          <form action={deleteAction}>
            <input type="hidden" name="id" value={costType.id} />
            <Button
              type="submit"
              variant="ghost"
              size="icon"
              aria-label={`Remove ${costType.name}`}
            >
              <Trash2 className="size-4" />
            </Button>
          </form>
        ) : null}
      </div>
    </div>
  )
}

export function CostTypesSection({
  costTypes,
  currency,
  locale,
}: {
  costTypes: CostType[]
  currency: string
  locale: string
}) {
  const upfront = costTypes.filter((type) => type.scope === 'upfront')
  const recurring = costTypes.filter((type) => type.scope === 'recurring')

  return (
    <Card>
      <CardContent className="flex flex-col gap-5 p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-muted-foreground text-sm">
            {costTypes.length} cost types. These are what the Add Cost list offers.
          </p>
          <CostTypeDialog
            locale={locale}
            trigger={
              <Button variant="outline" size="sm" className="gap-1.5">
                <Plus className="size-4" />
                Add cost type
              </Button>
            }
          />
        </div>

        {[
          { title: 'Upfront', items: upfront },
          { title: 'Ongoing', items: recurring },
        ].map((group) =>
          group.items.length === 0 ? null : (
            <div key={group.title} className="flex flex-col gap-1">
              <p className="font-medium text-muted-foreground text-sm">{group.title}</p>
              <div className="flex flex-col border-t">
                {group.items.map((costType) => (
                  <CostTypeRow
                    key={costType.id}
                    costType={costType}
                    currency={currency}
                    locale={locale}
                  />
                ))}
              </div>
            </div>
          ),
        )}
      </CardContent>
    </Card>
  )
}
