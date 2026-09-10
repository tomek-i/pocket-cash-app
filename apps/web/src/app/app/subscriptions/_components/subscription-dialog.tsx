'use client'

import type { Category } from '@repo/database'
import { BILLING_CYCLES, type BillingCycle } from '@repo/types'
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
import { createSubscription, type SubscriptionWithCategory, updateSubscription } from '../actions'

export const CYCLE_LABELS: Record<BillingCycle, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
}

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

  useEffect(() => {
    if (state?.ok) setOpen(false)
  }, [state])

  const amountDefault =
    state?.values?.amount ?? (subscription ? (subscription.amount / 100).toFixed(2) : '')

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
            <Label htmlFor="categoryId">Category (optional)</Label>
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

          <Field
            label="Notes (optional)"
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
