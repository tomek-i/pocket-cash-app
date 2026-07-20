'use client'

import type { Branch } from '@repo/database'
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
import { Field } from '../../_components/form-field'
import type { ActionState } from '../../actions'
import { createBranch, updateBranch } from '../actions'

export function BranchDialog({
  bankId,
  branch,
  trigger,
}: {
  bankId: string
  branch?: Branch
  trigger: ReactElement
}) {
  const action = branch ? updateBranch : createBranch
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
          <DialogTitle>{branch ? 'Edit branch' : 'Add branch'}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="grid gap-4">
          <input type="hidden" name="bankId" value={bankId} />
          {branch ? <input type="hidden" name="id" value={branch.id} /> : null}
          <Field
            label="Name"
            name="name"
            defaultValue={state?.values?.name ?? branch?.name ?? ''}
            placeholder="Oxford Street"
            error={state?.errors?.name}
          />
          <Field
            label="Sort code"
            name="sortCode"
            defaultValue={state?.values?.sortCode ?? branch?.sortCode ?? ''}
            placeholder="20-00-00"
            error={state?.errors?.sortCode}
          />
          <Field
            label="Routing number"
            name="routingNumber"
            defaultValue={state?.values?.routingNumber ?? branch?.routingNumber ?? ''}
            placeholder="026009593"
            error={state?.errors?.routingNumber}
          />
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : branch ? 'Save changes' : 'Add branch'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
