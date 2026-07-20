'use client'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  buttonVariants,
} from '@repo/ui'
import { type ReactElement, useActionState } from 'react'
import type { ActionState } from '../../actions'

/** Reusable destructive confirm. `hidden` fields are submitted with the action. */
export function ConfirmDeleteDialog({
  action,
  hidden,
  title,
  description,
  trigger,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>
  hidden: Record<string, string>
  title: string
  description: string
  trigger: ReactElement
}) {
  const [, formAction] = useActionState(action, null)
  return (
    <AlertDialog>
      <AlertDialogTrigger render={trigger} />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <form action={formAction}>
          {Object.entries(hidden).map(([key, value]) => (
            <input key={key} type="hidden" name={key} value={value} />
          ))}
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
            <AlertDialogAction type="submit" className={buttonVariants({ variant: 'destructive' })}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  )
}
