'use client'

import type { Jurisdiction, RateScheduleRow } from '@repo/database'
import {
  probeRateSchedule,
  RATE_UNITS,
  type RateBracket,
  type RateSchedule,
  type RateUnit,
  validateRateSchedule,
} from '@repo/property'
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
import { ArrowDown, ArrowUp, ChevronDown, Plus, Trash2 } from 'lucide-react'
import { type ReactElement, useActionState, useEffect, useMemo, useState } from 'react'
import type { ActionState } from '@/lib/action-state'
import { formatMoney } from '@/lib/money'
import { toCanonicalAmount } from '@/lib/number-format'
import { DateField } from '../../../property/_components/date-field'
import { MoneyInput } from '../../../property/_components/money-input'
import {
  toMajorInput,
  toMinorUnits,
  toPercentInput,
  toRateDecimal,
} from '../../../property/_lib/format'
import { createRateSchedule, updateRateSchedule } from '../schedules-actions'

const RATE_UNIT_LABELS: Record<RateUnit, string> = {
  percentage: 'Percentage',
  fixed: 'Flat amount',
  perUnit: 'Per unit',
}

/**
 * A bracket while it is being edited.
 *
 * Held as the strings the user typed rather than as numbers, so a half-typed
 * "1." or an empty box does not become a 0 behind their back. Converted to the
 * engine's units only when validating and saving.
 */
interface DraftBracket {
  minimum: string
  maximum: string
  baseAmount: string
  rate: string
  rateUnit: RateUnit
}

function toDraft(bracket: RateBracket): DraftBracket {
  return {
    minimum: toMajorInput(bracket.minimum),
    maximum: bracket.maximum === null ? '' : toMajorInput(bracket.maximum),
    baseAmount: toMajorInput(bracket.baseAmount),
    rate: toPercentInput(bracket.rate),
    rateUnit: bracket.rateUnit,
  }
}

/** An empty maximum means unlimited, which is how the final bracket is marked. */
function fromDraft(draft: DraftBracket): RateBracket {
  return {
    minimum: toMinorUnits(draft.minimum),
    maximum: draft.maximum.trim() === '' ? null : toMinorUnits(draft.maximum),
    baseAmount: toMinorUnits(draft.baseAmount),
    rate: draft.rateUnit === 'percentage' ? toRateDecimal(draft.rate) : toMinorUnits(draft.rate),
    rateUnit: draft.rateUnit,
  }
}

const EMPTY_BRACKET: DraftBracket = {
  minimum: '',
  maximum: '',
  baseAmount: '0',
  rate: '',
  rateUnit: 'percentage',
}

export function ScheduleEditor({
  schedule,
  jurisdictions,
  locale,
  trigger,
}: {
  schedule?: RateScheduleRow
  jurisdictions: Jurisdiction[]
  locale: string
  trigger: ReactElement
}) {
  const action = schedule ? updateRateSchedule : createRateSchedule
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, null)
  const [open, setOpen] = useState(false)
  const [showProbes, setShowProbes] = useState(false)

  const [jurisdictionKey, setJurisdictionKey] = useState(
    schedule?.jurisdictionKey ?? jurisdictions[0]?.key ?? '',
  )
  const [currency, setCurrency] = useState(
    schedule?.currency ?? jurisdictions[0]?.currency ?? 'USD',
  )
  const [brackets, setBrackets] = useState<DraftBracket[]>(
    schedule ? schedule.brackets.map(toDraft) : [{ ...EMPTY_BRACKET, minimum: '0' }],
  )

  useEffect(() => {
    if (state?.ok) setOpen(false)
  }, [state])

  const engineBrackets = useMemo(() => brackets.map(fromDraft), [brackets])

  // The same validator the server runs. This copy is for feedback while typing.
  const candidate: RateSchedule = useMemo(
    () => ({
      id: schedule?.id ?? 'draft',
      name: schedule?.name ?? 'Draft',
      jurisdiction: jurisdictionKey,
      country: '',
      region: null,
      currency,
      effectiveFrom: schedule?.effectiveFrom ?? '2000-01-01',
      effectiveTo: schedule?.effectiveTo ?? null,
      calculationType: 'bracketed',
      version: schedule?.version ?? 1,
      brackets: engineBrackets,
    }),
    [schedule, jurisdictionKey, currency, engineBrackets],
  )

  const validation = useMemo(() => validateRateSchedule(candidate), [candidate])
  const probes = useMemo(
    () => (validation.valid ? probeRateSchedule(candidate) : []),
    [validation.valid, candidate],
  )

  const errors = validation.issues.filter((issue) => issue.severity === 'error')
  const warnings = validation.issues.filter((issue) => issue.severity === 'warning')

  const update = (index: number, patch: Partial<DraftBracket>) =>
    setBrackets((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))

  const move = (index: number, direction: -1 | 1) =>
    setBrackets((rows) => {
      const target = index + direction
      if (target < 0 || target >= rows.length) return rows
      const next = [...rows]
      const [moved] = next.splice(index, 1)
      if (moved) next.splice(target, 0, moved)
      return next
    })

  const addBracket = () =>
    setBrackets((rows) => {
      const last = rows[rows.length - 1]
      // A new band starts where the previous one ended, which is what makes a
      // contiguous schedule the default rather than something to fix afterwards.
      return [...rows, { ...EMPTY_BRACKET, minimum: last?.maximum ?? '' }]
    })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{schedule ? 'Edit rate schedule' : 'Add a rate schedule'}</DialogTitle>
        </DialogHeader>

        <form action={formAction} className="grid gap-5">
          {schedule ? <input type="hidden" name="id" value={schedule.id} /> : null}
          <input type="hidden" name="jurisdictionKey" value={jurisdictionKey} />
          <input type="hidden" name="currency" value={currency} />
          <input type="hidden" name="brackets" value={JSON.stringify(engineBrackets)} />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                name="name"
                defaultValue={state?.values?.name ?? schedule?.name ?? ''}
                placeholder="NSW Transfer Duty 2027/28"
              />
              {state?.errors?.name?.[0] ? (
                <p className="text-destructive text-xs">{state.errors.name[0]}</p>
              ) : null}
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="jurisdiction">Jurisdiction</Label>
              <Select
                value={jurisdictionKey}
                items={Object.fromEntries(jurisdictions.map((j) => [j.key, j.name]))}
                onValueChange={(value) => {
                  if (value === null) return
                  setJurisdictionKey(value)
                  const match = jurisdictions.find((j) => j.key === value)
                  if (match) setCurrency(match.currency)
                }}
              >
                <SelectTrigger id="jurisdiction">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {jurisdictions.map((j) => (
                    <SelectItem key={j.key} value={j.key}>
                      {j.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-1.5">
              <Label htmlFor="groupKey">Charge type</Label>
              <Input
                id="groupKey"
                name="groupKey"
                defaultValue={state?.values?.groupKey ?? schedule?.groupKey ?? 'transfer-tax'}
                placeholder="transfer-tax"
              />
              <p className="text-muted-foreground text-xs">
                Costs find a schedule by this, so it must match the cost that uses it.
              </p>
              {state?.errors?.groupKey?.[0] ? (
                <p className="text-destructive text-xs">{state.errors.groupKey[0]}</p>
              ) : null}
            </div>
            <DateField
              label="Effective from"
              name="effectiveFrom"
              defaultValue={state?.values?.effectiveFrom ?? schedule?.effectiveFrom ?? ''}
              error={state?.errors?.effectiveFrom}
            />
            <div className="grid gap-1.5">
              <DateField
                label="Effective to"
                name="effectiveTo"
                defaultValue={state?.values?.effectiveTo ?? schedule?.effectiveTo ?? ''}
                error={state?.errors?.effectiveTo}
              />
              <p className="text-muted-foreground text-xs">Leave empty for open ended.</p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <Label>Brackets</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={addBracket}
              >
                <Plus className="size-4" />
                Add bracket
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground text-xs">
                    <th className="pb-1 font-medium">From</th>
                    <th className="pb-1 font-medium">To</th>
                    <th className="pb-1 font-medium">Base</th>
                    <th className="pb-1 font-medium">Rate</th>
                    <th className="pb-1 font-medium">Unit</th>
                    <th className="pb-1" />
                  </tr>
                </thead>
                <tbody>
                  {brackets.map((bracket, index) => (
                    // Position is the identity here: brackets have no id, and
                    // reordering is one of the things this editor does.
                    // biome-ignore lint/suspicious/noArrayIndexKey: a bracket is identified by its position
                    <tr key={index} className="border-t">
                      <td className="py-1.5 pr-2">
                        <MoneyInput
                          locale={locale}
                          value={toCanonicalAmount(bracket.minimum, locale)}
                          onCanonicalChange={(next) => update(index, { minimum: next })}
                          id={`bracket-${index}-minimum`}
                          label={`Bracket ${index + 1} from`}
                          hideLabel
                        />
                      </td>
                      <td className="py-1.5 pr-2">
                        <MoneyInput
                          locale={locale}
                          value={toCanonicalAmount(bracket.maximum, locale)}
                          onCanonicalChange={(next) => update(index, { maximum: next })}
                          id={`bracket-${index}-maximum`}
                          label={`Bracket ${index + 1} to`}
                          hideLabel
                        />
                      </td>
                      <td className="py-1.5 pr-2">
                        <MoneyInput
                          locale={locale}
                          value={toCanonicalAmount(bracket.baseAmount, locale)}
                          onCanonicalChange={(next) => update(index, { baseAmount: next })}
                          id={`bracket-${index}-baseAmount`}
                          label={`Bracket ${index + 1} base`}
                          hideLabel
                        />
                      </td>
                      <td className="py-1.5 pr-2">
                        <Input
                          value={bracket.rate}
                          onChange={(e) => update(index, { rate: e.target.value })}
                          inputMode="decimal"
                          className="h-8"
                          aria-label={`Bracket ${index + 1} rate`}
                        />
                      </td>
                      <td className="w-36 py-1.5 pr-2">
                        <Select
                          value={bracket.rateUnit}
                          items={RATE_UNIT_LABELS}
                          onValueChange={(value) =>
                            value !== null && update(index, { rateUnit: value as RateUnit })
                          }
                        >
                          <SelectTrigger className="h-8" aria-label={`Bracket ${index + 1} unit`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {RATE_UNITS.map((unit) => (
                              <SelectItem key={unit} value={unit}>
                                {RATE_UNIT_LABELS[unit]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="py-1.5">
                        <div className="flex items-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={`Move bracket ${index + 1} up`}
                            disabled={index === 0}
                            onClick={() => move(index, -1)}
                          >
                            <ArrowUp className="size-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={`Move bracket ${index + 1} down`}
                            disabled={index === brackets.length - 1}
                            onClick={() => move(index, 1)}
                          >
                            <ArrowDown className="size-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={`Remove bracket ${index + 1}`}
                            onClick={() =>
                              setBrackets((rows) => rows.filter((_, i) => i !== index))
                            }
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-muted-foreground text-xs">
              A band runs from its start up to, but not including, its end. Leave the last band's
              end empty to mean unlimited.
            </p>
          </div>

          {errors.length > 0 ? (
            <div className="flex flex-col gap-1 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
              <p className="font-medium text-destructive text-sm">Fix these before saving</p>
              <ul className="list-disc pl-4 text-destructive text-xs">
                {errors.map((issue) => (
                  <li key={`${issue.code}-${issue.bracketIndex ?? 'schedule'}`}>
                    {issue.bracketIndex === undefined
                      ? issue.message
                      : `Bracket ${issue.bracketIndex + 1}: ${issue.message}`}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {warnings.length > 0 ? (
            <ul className="list-disc pl-4 text-muted-foreground text-xs">
              {warnings.map((issue) => (
                <li key={`${issue.code}-${issue.bracketIndex ?? 'schedule'}`}>{issue.message}</li>
              ))}
            </ul>
          ) : null}

          {state?.errors?.brackets?.length ? (
            <div className="flex flex-col gap-1 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
              <p className="font-medium text-destructive text-sm">The server refused this</p>
              <ul className="list-disc pl-4 text-destructive text-xs">
                {state.errors.brackets.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* The self test. Comparing these against the published table catches an
              off-by-one boundary far better than any rule can. */}
          {probes.length > 0 ? (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setShowProbes((open) => !open)}
                className="flex w-fit items-center gap-1.5 text-muted-foreground text-sm hover:text-foreground"
              >
                <ChevronDown className={showProbes ? 'size-4 rotate-180' : 'size-4'} />
                Check against the published table ({probes.length} values)
              </button>
              {showProbes ? (
                <div className="max-h-64 overflow-y-auto rounded-md bg-muted/40 p-3">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-muted-foreground text-xs">
                        <th className="pb-1 font-medium">Value</th>
                        <th className="pb-1 font-medium">Charge</th>
                        <th className="pb-1 font-medium">Band</th>
                      </tr>
                    </thead>
                    <tbody>
                      {probes.map((probe) => (
                        <tr key={probe.value}>
                          <td className="py-0.5 tabular-nums">
                            {formatMoney(probe.value, currency)}
                          </td>
                          <td className="py-0.5 tabular-nums">
                            {probe.amount === null ? '—' : formatMoney(probe.amount, currency)}
                          </td>
                          <td className="py-0.5 text-muted-foreground text-xs">{probe.label}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          ) : null}

          <DialogFooter>
            <Button type="submit" disabled={pending || errors.length > 0}>
              {pending ? 'Saving…' : schedule ? 'Save schedule' : 'Add schedule'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
