'use client'

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
import { type BudgetBucketView, renameBudgetBucket } from '../actions'

export function BucketRenameDialog({
  bucket,
  trigger,
}: {
  bucket: BudgetBucketView
  trigger: ReactElement
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    renameBudgetBucket,
    null,
  )
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (state?.ok) setOpen(false)
  }, [state])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename {bucket.label}</DialogTitle>
          <DialogDescription>
            Only the name changes. It stays a {bucket.kind} bucket ({bucket.defaultLabel}). Leave it
            empty to go back to the default name.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="grid gap-4">
          <input type="hidden" name="type" value={bucket.type} />
          <Field
            label="Name"
            name="label"
            defaultValue={state?.values?.label ?? bucket.customLabel ?? ''}
            placeholder={bucket.defaultLabel}
            error={state?.errors?.label}
          />
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : 'Save name'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
