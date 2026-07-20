'use client'

import type { Category } from '@repo/database'
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
import { createCategory, updateCategory } from '../actions'

export function CategoryDialog({
  category,
  trigger,
}: {
  category?: Category
  trigger: ReactElement
}) {
  const action = category ? updateCategory : createCategory
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
          <DialogTitle>{category ? 'Edit category' : 'Add category'}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="grid gap-4">
          {category ? <input type="hidden" name="id" value={category.id} /> : null}

          <Field
            label="Name"
            name="name"
            defaultValue={state?.values?.name ?? category?.name ?? ''}
            placeholder="Groceries"
            error={state?.errors?.name}
          />
          <ColorField
            label="Colour (optional)"
            name="color"
            defaultValue={state?.values?.color ?? category?.color ?? ''}
            placeholder="#22c55e"
            error={state?.errors?.color}
          />
          <Field
            label="Icon (optional)"
            name="icon"
            defaultValue={state?.values?.icon ?? category?.icon ?? ''}
            placeholder="lucide icon name, e.g. shopping-cart"
            error={state?.errors?.icon}
          />

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : category ? 'Save changes' : 'Add category'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
