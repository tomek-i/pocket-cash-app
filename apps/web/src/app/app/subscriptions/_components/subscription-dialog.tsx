'use client'

import type { Category } from '@repo/database'
import { BILLING_CYCLES, SUBSCRIPTION_STATUSES, type SubscriptionStatus } from '@repo/types'
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
  OptionSelect,
} from '@repo/ui'
import { type ReactElement, useActionState, useEffect, useState } from 'react'
import type { ActionState } from '@/lib/action-state'
import { Field } from '../../banks/_components/form-field'
import { CategoryIcon } from '../../categories/_components/category-icon'
import { CYCLE_LABELS, STATUS_LABELS, todayIso } from '../_lib/schedule'
import { createSubscription, type SubscriptionWithCategory, updateSubscription } from '../actions'

export function SubscriptionDialog({
  categories,
  subscription,
  defaultCurrency = 'USD',
  trigger,
}: {
  // Icon and colour included, so the picker looks like the thing it picks.
  categories: Pick<Category, 'id' | 'name' | 'icon' | 'color'>[]
  subscription?: SubscriptionWithCategory
  defaultCurrency?: string
  trigger: ReactElement
}) {
  const action = subscription ? updateSubscription : createSubscription
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, null)
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<SubscriptionStatus>(
    (state?.values?.status as SubscriptionStatus | undefined) ?? subscription?.status ?? 'active',
  )

  useEffect(() => {
    if (state?.ok) setOpen(false)
    else if (state?.values?.status) setStatus(state.values.status as SubscriptionStatus)
  }, [state])

  const amountDefault =
    state?.values?.amount ?? (subscription ? (subscription.amount / 100).toFixed(2) : '')

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // The status may have changed from the card menu since the last open.
        if (next) setStatus(subscription?.status ?? 'active')
        setOpen(next)
      }}
    >
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{subscription ? 'Edit subscription' : 'Add subscription'}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="grid gap-4">
          {subscription ? <input type="hidden" name="id" value={subscription.id} /> : null}

          <Field
            label="Name"
            name="name"
            defaultValue={state?.values?.name ?? subscription?.name ?? ''}
            placeholder="Netflix"
            error={state?.errors?.name}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Amount"
              name="amount"
              defaultValue={amountDefault}
              placeholder="9.99"
              error={state?.errors?.amount}
            />
            <Field
              label="Currency"
              name="currency"
              defaultValue={state?.values?.currency ?? subscription?.currency ?? defaultCurrency}
              placeholder="USD"
              error={state?.errors?.currency}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="cycle">Billing cycle</Label>
              <OptionSelect
                id="cycle"
                name="cycle"
                defaultValue={state?.values?.cycle ?? subscription?.cycle ?? 'monthly'}
                options={BILLING_CYCLES.map((cycle) => ({
                  value: cycle,
                  label: CYCLE_LABELS[cycle],
                }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="nextPaymentDate">Next payment</Label>
              <Input
                id="nextPaymentDate"
                type="date"
                name="nextPaymentDate"
                defaultValue={state?.values?.nextPaymentDate ?? subscription?.nextPaymentDate ?? ''}
              />
              {state?.errors?.nextPaymentDate?.[0] ? (
                <p className="text-destructive text-xs">{state.errors.nextPaymentDate[0]}</p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="categoryId">Category</Label>
            <OptionSelect
              id="categoryId"
              name="categoryId"
              defaultValue={state?.values?.categoryId ?? subscription?.categoryId ?? 'none'}
              options={[
                { value: 'none', label: 'No category' },
                ...categories.map((c) => ({
                  value: c.id,
                  label: (
                    <span className="flex items-center gap-2">
                      <CategoryIcon name={c.icon} color={c.color} className="size-4" />
                      {c.name}
                    </span>
                  ),
                })),
              ]}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="status">Status</Label>
              <OptionSelect
                id="status"
                name="status"
                value={status}
                onValueChange={(next) => setStatus(next as SubscriptionStatus)}
                options={SUBSCRIPTION_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
              />
            </div>
            {status === 'paused' ? (
              <div className="grid gap-1.5">
                <Label htmlFor="pausedUntil">Resumes on</Label>
                <Input
                  id="pausedUntil"
                  type="date"
                  name="pausedUntil"
                  defaultValue={state?.values?.pausedUntil ?? subscription?.pausedUntil ?? ''}
                />
                <p className="text-muted-foreground text-xs">
                  Leave empty to keep it paused until you resume it.
                </p>
              </div>
            ) : null}
            {status === 'cancelled' ? (
              <div className="grid gap-1.5">
                <Label htmlFor="endDate">End date</Label>
                <Input
                  id="endDate"
                  type="date"
                  name="endDate"
                  defaultValue={state?.values?.endDate ?? subscription?.endDate ?? todayIso()}
                />
                <p className="text-muted-foreground text-xs">It keeps counting until this date.</p>
              </div>
            ) : null}
          </div>

          <Field
            label="Notes"
            name="notes"
            defaultValue={state?.values?.notes ?? subscription?.notes ?? ''}
            placeholder="Family plan"
            error={state?.errors?.notes}
          />

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : subscription ? 'Save changes' : 'Add subscription'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
