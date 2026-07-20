'use client'

import type { Bank } from '@repo/database'
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
import { deleteBank } from '../actions'

export function DeleteBankDialog({ bank, trigger }: { bank: Bank; trigger: ReactElement }) {
  const [, formAction] = useActionState(deleteBank, null)
  return (
    <AlertDialog>
      <AlertDialogTrigger render={trigger} />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{bank.name}”?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes the bank and all its branches, accounts, and transactions.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <form action={formAction}>
          <input type="hidden" name="id" value={bank.id} />
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
