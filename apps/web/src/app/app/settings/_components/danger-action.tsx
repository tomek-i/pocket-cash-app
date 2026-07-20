'use client'

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Button,
  Input,
  Label,
} from '@repo/ui'
import { useState, useTransition } from 'react'
import type { DangerResult } from '../actions'

/**
 * A destructive workspace action gated behind a type-to-confirm dialog. The
 * confirm button only arms once the user types the exact phrase.
 */
export function DangerAction({
  title,
  description,
  buttonLabel,
  confirmPhrase,
  action,
}: {
  title: string
  description: string
  buttonLabel: string
  confirmPhrase: string
  action: () => Promise<DangerResult>
}) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const armed = value.trim().toUpperCase() === confirmPhrase.toUpperCase()

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="font-medium text-sm">{title}</p>
        <p className="text-muted-foreground text-sm">{description}</p>
        {notice ? <p className="mt-1 text-sm text-success">{notice}</p> : null}
      </div>
      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) setValue('')
        }}
      >
        <AlertDialogTrigger
          render={
            <Button variant="destructive" className="shrink-0">
              {buttonLabel}
            </Button>
          }
        />
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{description} This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="confirm-phrase" className="text-muted-foreground text-xs">
              Type <span className="font-mono font-semibold text-foreground">{confirmPhrase}</span>{' '}
              to confirm
            </Label>
            <Input
              id="confirm-phrase"
              value={value}
              autoComplete="off"
              onChange={(e) => setValue(e.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel type="button" disabled={pending}>
              Cancel
            </AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={!armed || pending}
              onClick={() =>
                startTransition(async () => {
                  const res = await action()
                  setNotice('error' in res ? res.error : `Removed ${res.deleted} record(s).`)
                  setValue('')
                  setOpen(false)
                })
              }
            >
              {pending ? 'Working…' : buttonLabel}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
