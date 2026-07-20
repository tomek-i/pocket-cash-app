'use client'

import type { Bank } from '@repo/database'
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@repo/ui'
import { type ReactElement, useActionState, useEffect, useState } from 'react'
import { type ActionState, createBank, updateBank } from '../actions'
import { Field } from './form-field'

export function BankDialog({ bank, trigger }: { bank?: Bank; trigger: ReactElement }) {
  const action = bank ? updateBank : createBank
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, null)
  const [open, setOpen] = useState(false)

  // Close the dialog once the action reports success.
  useEffect(() => {
    if (state?.ok) setOpen(false)
  }, [state])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{bank ? 'Edit bank' : 'Add bank'}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="grid gap-4">
          {bank ? <input type="hidden" name="id" value={bank.id} /> : null}
          <Field
            label="Name"
            name="name"
            defaultValue={state?.values?.name ?? bank?.name ?? ''}
            placeholder="Barclays"
            error={state?.errors?.name}
          />
          <Field
            label="Country code"
            name="country"
            defaultValue={state?.values?.country ?? bank?.country ?? ''}
            placeholder="GB"
            error={state?.errors?.country}
          />
          <Field
            label="Logo URL"
            name="logoUrl"
            defaultValue={state?.values?.logoUrl ?? bank?.logoUrl ?? ''}
            placeholder="https://…"
            error={state?.errors?.logoUrl}
          />
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : bank ? 'Save changes' : 'Add bank'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
