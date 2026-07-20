'use client'

import type { Tag } from '@repo/database'
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
import type { ActionState } from '@/lib/action-state'
import { ColorField } from '../../_components/color-field'
import { Field } from '../../banks/_components/form-field'
import { createTag, updateTag } from '../actions'

export function TagDialog({ tag, trigger }: { tag?: Tag; trigger: ReactElement }) {
  const action = tag ? updateTag : createTag
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
          <DialogTitle>{tag ? 'Edit tag' : 'Add tag'}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="grid gap-4">
          {tag ? <input type="hidden" name="id" value={tag.id} /> : null}

          <Field
            label="Name"
            name="name"
            defaultValue={state?.values?.name ?? tag?.name ?? ''}
            placeholder="reimbursable"
            error={state?.errors?.name}
          />
          <ColorField
            label="Colour (optional)"
            name="color"
            defaultValue={state?.values?.color ?? tag?.color ?? ''}
            placeholder="#3b82f6"
            error={state?.errors?.color}
          />

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : tag ? 'Save changes' : 'Add tag'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
