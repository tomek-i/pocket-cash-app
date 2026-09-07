'use client'

import type { Property } from '@repo/database'
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
import { deleteProperty } from '../actions'

export function DeletePropertyDialog({
  property,
  trigger,
}: {
  property: Property
  trigger: ReactElement
}) {
  const [, formAction] = useActionState(deleteProperty, null)
  return (
    <AlertDialog>
      <AlertDialogTrigger render={trigger} />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{property.name}”?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes the property along with its loans, costs, rental details and
            scenarios. To keep the history of a property you no longer own, mark it as sold instead.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <form action={formAction}>
          <input type="hidden" name="id" value={property.id} />
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
