'use client'

import type { CostBreakdown } from '@repo/property'
import { Badge, Button } from '@repo/ui'
import { ChevronDown, RotateCcw, Trash2 } from 'lucide-react'
import { useActionState, useState } from 'react'
import { formatMoney } from '@/lib/money'
import { MoneyInput } from '../../../_components/money-input'
import type { EvaluatedCost } from '../../../_lib/costs'
import { toMajorInput } from '../../../_lib/format'
import { removePropertyCost, setPropertyCostValue, togglePropertyCost } from '../costs-actions'

/**
 * The "Calculation details" panel.
 *
 * Rendered from the breakdown the engine returns, never by re-deriving the sum
 * here. A user who wants to check a figure against the published table needs the
 * bracket, the base, the rate and the amount over the threshold, in that order.
 */
function CalculationDetails({
  breakdown,
  currency,
}: {
  breakdown: CostBreakdown
  currency: string
}) {
  const rows: [string, string][] = []

  switch (breakdown.kind) {
    case 'bracketed': {
      const { bracket, schedule, baseValue } = breakdown
      const upper =
        bracket.bracket.maximum === null
          ? 'no upper limit'
          : formatMoney(bracket.bracket.maximum, currency)
      rows.push(
        ['Schedule', `${schedule.name} (v${schedule.version})`],
        ['Calculated on', formatMoney(baseValue, currency)],
        ['Applicable bracket', `${formatMoney(bracket.bracket.minimum, currency)} to ${upper}`],
        ['Base amount', formatMoney(bracket.baseAmount, currency)],
        ['Rate', `${(bracket.rate * 100).toFixed(2)}%`],
        ['Amount over threshold', formatMoney(bracket.amountOverThreshold, currency)],
        ['Calculated', formatMoney(bracket.total, currency)],
      )
      break
    }
    case 'percentage':
      rows.push(
        ['Calculated on', formatMoney(breakdown.baseValue, currency)],
        ['Rate', `${(breakdown.percentage * 100).toFixed(2)}%`],
      )
      break
    case 'formula':
      rows.push(['Formula', breakdown.formula])
      break
    case 'fixed':
      rows.push(['Default amount', formatMoney(breakdown.defaultValue, currency)])
      break
    default:
      rows.push(['Entered by hand', 'No calculation'])
  }

  return (
    <dl className="mt-3 grid gap-1.5 rounded-md bg-muted/40 p-3 text-sm sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between gap-4 sm:contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="text-right sm:text-left">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

/** A single amount field that saves on submit. */
function AmountForm({
  costId,
  field,
  value,
  label,
  placeholder,
  locale,
}: {
  costId: string
  field: 'overrideValue' | 'manualValue' | 'actualValue'
  value: string
  label: string
  placeholder?: number
  locale: string
}) {
  const [state, formAction, pending] = useActionState(setPropertyCostValue, null)

  return (
    <form action={formAction} className="flex items-end gap-2">
      <input type="hidden" name="id" value={costId} />
      <input type="hidden" name="field" value={field} />
      <div className="w-36">
        <MoneyInput
          name="value"
          label={label}
          locale={locale}
          defaultValue={value}
          placeholder={placeholder}
        />
      </div>
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        {pending ? 'Saving…' : 'Save'}
      </Button>
      {state?.errors?.value?.[0] ? (
        <p className="text-destructive text-xs">{state.errors.value[0]}</p>
      ) : null}
    </form>
  )
}

export function CostRow({
  entry,
  currency,
  locale,
}: {
  entry: EvaluatedCost
  currency: string
  locale: string
}) {
  const { row, result } = entry
  const [showDetails, setShowDetails] = useState(false)
  const [editingOverride, setEditingOverride] = useState(false)
  const [editingActual, setEditingActual] = useState(false)

  const [, toggleAction] = useActionState(togglePropertyCost, null)
  const [, removeAction] = useActionState(removePropertyCost, null)
  const [, clearOverrideAction] = useActionState(setPropertyCostValue, null)

  return (
    <div
      className={
        row.enabled ? 'border-b py-3 last:border-b-0' : 'border-b py-3 opacity-55 last:border-b-0'
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <form action={toggleAction} className="pt-0.5">
            <input type="hidden" name="id" value={row.id} />
            <input type="hidden" name="enabled" value={row.enabled ? 'false' : 'true'} />
            <button
              type="submit"
              aria-label={row.enabled ? `Disable ${result.name}` : `Enable ${result.name}`}
              className={
                row.enabled
                  ? 'flex size-4 items-center justify-center rounded border border-primary bg-primary text-[10px] text-primary-foreground'
                  : 'size-4 rounded border border-input'
              }
            >
              {row.enabled ? '✓' : ''}
            </button>
          </form>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">{result.name}</p>
              {result.automatic ? (
                <Badge variant="outline" className="text-[10px]">
                  Calculated
                </Badge>
              ) : null}
              {result.overridden ? (
                <Badge variant="secondary" className="text-[10px]">
                  Custom value
                </Badge>
              ) : null}
              {!row.costType.isSystem ? (
                <Badge variant="outline" className="text-[10px]">
                  Custom cost
                </Badge>
              ) : null}
            </div>

            {result.error ? (
              <p className="text-destructive text-xs">{result.error.message}</p>
            ) : result.overridden && result.calculatedValue !== null ? (
              <p className="text-muted-foreground text-xs">
                Default: {formatMoney(result.calculatedValue, currency)}
              </p>
            ) : result.automatic ? (
              <p className="text-muted-foreground text-xs">Calculated automatically</p>
            ) : null}

            {result.actual !== null ? (
              <p className="text-muted-foreground text-xs">
                Actual: {formatMoney(result.actual, currency)}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <p className="font-medium tabular-nums">{formatMoney(result.amount, currency)}</p>

          {result.automatic || result.breakdown.kind === 'fixed' ? (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Calculation details"
              onClick={() => setShowDetails((open) => !open)}
            >
              <ChevronDown className={showDetails ? 'size-4 rotate-180' : 'size-4'} />
            </Button>
          ) : null}

          <form action={removeAction}>
            <input type="hidden" name="id" value={row.id} />
            <Button type="submit" variant="ghost" size="icon" aria-label={`Remove ${result.name}`}>
              <Trash2 className="size-4" />
            </Button>
          </form>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-end gap-4 pl-7">
        {result.calculationType === 'manual' ? (
          <AmountForm
            costId={row.id}
            field="manualValue"
            value={toMajorInput(row.manualValue)}
            label="Amount"
            placeholder={2000}
            locale={locale}
          />
        ) : editingOverride ? (
          <AmountForm
            costId={row.id}
            field="overrideValue"
            value={toMajorInput(row.overrideValue)}
            label="Override amount"
            placeholder={(result.calculatedValue ?? 0) / 100}
            locale={locale}
          />
        ) : (
          <Button variant="outline" size="sm" onClick={() => setEditingOverride(true)}>
            Override
          </Button>
        )}

        {result.overridden ? (
          // Clearing the override restores the calculation. It never writes the
          // default in as a fixed amount, which would freeze the cost.
          <form action={clearOverrideAction}>
            <input type="hidden" name="id" value={row.id} />
            <input type="hidden" name="field" value="overrideValue" />
            <input type="hidden" name="value" value="" />
            <Button type="submit" variant="ghost" size="sm" className="gap-1.5">
              <RotateCcw className="size-3.5" />
              {result.automatic ? 'Use calculation' : 'Reset to default'}
            </Button>
          </form>
        ) : null}

        {editingActual ? (
          <AmountForm
            costId={row.id}
            field="actualValue"
            value={toMajorInput(row.actualValue)}
            label="Actual amount"
            placeholder={result.estimate / 100}
            locale={locale}
          />
        ) : (
          <Button variant="ghost" size="sm" onClick={() => setEditingActual(true)}>
            {result.actual === null ? 'Record actual' : 'Edit actual'}
          </Button>
        )}
      </div>

      {showDetails ? <CalculationDetails breakdown={result.breakdown} currency={currency} /> : null}
    </div>
  )
}
