'use client'

import { Button, Card, CardContent, Input } from '@repo/ui'
import { Plus, Trash2 } from 'lucide-react'
import { useActionState, useEffect, useState } from 'react'
import { formatMoney } from '@/lib/money'
import { MoneyInput } from '../../../_components/money-input'
import { toMajorInput } from '../../../_lib/format'
import type { AvailableFundRow, FundsSummary } from '../../../_lib/funds'
import {
  addAvailableFund,
  removeAvailableFund,
  toggleAvailableFund,
  updateAvailableFund,
} from '../funds-actions'

function FundRow({
  fund,
  currency,
  locale,
}: {
  fund: AvailableFundRow
  currency: string
  locale: string
}) {
  const [, updateAction, updating] = useActionState(updateAvailableFund, null)
  const [, toggleAction] = useActionState(toggleAvailableFund, null)
  const [, removeAction] = useActionState(removeAvailableFund, null)
  const [label, setLabel] = useState(fund.label)
  const [amount, setAmount] = useState(toMajorInput(fund.amount))

  return (
    <div
      className={
        fund.enabled
          ? 'flex flex-wrap items-center justify-between gap-3 border-b py-3 last:border-b-0'
          : 'flex flex-wrap items-center justify-between gap-3 border-b py-3 opacity-55 last:border-b-0'
      }
    >
      <form action={toggleAction}>
        <input type="hidden" name="id" value={fund.id} />
        <input type="hidden" name="enabled" value={fund.enabled ? 'false' : 'true'} />
        <button
          type="submit"
          aria-label={fund.enabled ? `Exclude ${fund.label}` : `Include ${fund.label}`}
          className={
            fund.enabled
              ? 'flex size-4 items-center justify-center rounded border border-primary bg-primary text-[10px] text-primary-foreground'
              : 'size-4 rounded border border-input'
          }
        >
          {fund.enabled ? '✓' : ''}
        </button>
      </form>

      <form action={updateAction} className="flex flex-1 flex-wrap items-center gap-2">
        <input type="hidden" name="id" value={fund.id} />
        <Input
          name="label"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          className="h-8 w-48"
          aria-label={`${fund.label} name`}
        />
        <div className="w-40">
          <MoneyInput
            name="amount"
            label={`${fund.label} amount`}
            hideLabel
            locale={locale}
            value={amount}
            onCanonicalChange={setAmount}
            id={`fund-amount-${fund.id}`}
          />
        </div>
        <Button type="submit" size="sm" variant="secondary" disabled={updating}>
          {updating ? 'Saving…' : 'Save'}
        </Button>
      </form>

      <div className="flex items-center gap-2">
        <p className="w-32 text-right tabular-nums">{formatMoney(fund.amount, currency)}</p>
        <form action={removeAction}>
          <input type="hidden" name="id" value={fund.id} />
          <Button type="submit" variant="ghost" size="icon" aria-label={`Remove ${fund.label}`}>
            <Trash2 className="size-4" />
          </Button>
        </form>
      </div>
    </div>
  )
}

function AddFundForm({ locale }: { locale: string }) {
  const [state, formAction, pending] = useActionState(addAvailableFund, null)

  // Remount the form after each successful add so the boxes are empty for the
  // next one. `useActionState` hands back a new object per submit, so keying on
  // a counter driven by that catches every success, not just the first.
  const [added, setAdded] = useState(0)
  useEffect(() => {
    if (state?.ok) setAdded((count) => count + 1)
  }, [state])

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2" key={added}>
      <div className="grid gap-1">
        <span className="text-muted-foreground text-xs">Name</span>
        <Input name="label" placeholder="Savings account" className="h-8 w-48" aria-label="Name" />
      </div>
      <div className="w-40">
        <MoneyInput name="amount" label="Amount" locale={locale} placeholder={180000} />
      </div>
      <Button type="submit" size="sm" variant="outline" className="gap-1.5" disabled={pending}>
        <Plus className="size-4" />
        {pending ? 'Adding…' : 'Add'}
      </Button>
      {state?.errors?.label?.[0] ? (
        <p className="text-destructive text-xs">{state.errors.label[0]}</p>
      ) : null}
    </form>
  )
}

/**
 * What the user has, against what the purchase needs.
 *
 * Typed in by hand rather than read from account balances, so it is whatever the
 * user says it is rather than whatever the last CSV import implied.
 *
 * The point is not the total but the line under it. With everything else on the
 * planner recalculating live, a negative Remaining is something to push against:
 * drop the deposit, drop the price, and watch it turn positive.
 */
export function AvailableFunds({
  summary,
  currency,
  locale,
}: {
  summary: FundsSummary
  currency: string
  locale: string
}) {
  const { position } = summary

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5">
        {summary.funds.length === 0 ? (
          <p className="py-4 text-center text-muted-foreground text-sm">
            Nothing recorded yet. Add your savings, a term deposit, a gift, anything you would put
            towards this.
          </p>
        ) : (
          <div className="flex flex-col border-t">
            {summary.funds.map((fund) => (
              <FundRow key={fund.id} fund={fund} currency={currency} locale={locale} />
            ))}
          </div>
        )}

        <AddFundForm locale={locale} />

        <dl className="grid gap-2 border-t pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Available funds</dt>
            <dd className="tabular-nums">{formatMoney(summary.total, currency)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Cash required</dt>
            <dd className="tabular-nums">-{formatMoney(position.cashRequired, currency)}</dd>
          </div>
          <div className="flex justify-between border-t pt-2 font-semibold">
            <dt>{position.shortfall ? 'Short by' : 'Remaining'}</dt>
            <dd className={position.shortfall ? 'text-destructive tabular-nums' : 'tabular-nums'}>
              {formatMoney(
                position.shortfall ? Math.abs(position.remaining) : position.remaining,
                currency,
              )}
            </dd>
          </div>
          {position.shortfall ? (
            <p className="text-muted-foreground text-xs">
              Lower the price or the deposit above and this updates as you go.
            </p>
          ) : null}
        </dl>
      </CardContent>
    </Card>
  )
}
