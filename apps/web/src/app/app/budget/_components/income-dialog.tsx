'use client'

import type { BudgetIncome } from '@repo/database'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@repo/ui'
import { type ReactElement, useActionState, useEffect, useState } from 'react'
import type { ActionState } from '@/lib/action-state'
import { Field } from '../../banks/_components/form-field'
import { createBudgetIncome, updateBudgetIncome } from '../actions'

export function IncomeDialog({
  income,
  trigger,
}: {
  income?: BudgetIncome
  trigger: ReactElement
}) {
  const action = income ? updateBudgetIncome : createBudgetIncome
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (state?.ok) setOpen(false)
  }, [state])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{income ? 'Edit income' : 'Add income'}</DialogTitle>
          <DialogDescription>
            The net amount that lands each month, after tax and fees.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="grid gap-4">
          {income ? <input type="hidden" name="id" value={income.id} /> : null}

          <Field
            label="Name"
            name="name"
            defaultValue={state?.values?.name ?? income?.name ?? ''}
            placeholder="Salary"
            error={state?.errors?.name}
          />
          <Field
            label="Monthly amount"
            name="amount"
            defaultValue={state?.values?.amount ?? (income ? (income.amount / 100).toFixed(2) : '')}
            placeholder="6500.00"
            error={state?.errors?.amount}
            help="For rent from an investment property, use what the agent pays out."
          />

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : income ? 'Save changes' : 'Add income'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
