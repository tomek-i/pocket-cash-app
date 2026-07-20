'use client'

import { Button, Input } from '@repo/ui'
import { useState, useTransition } from 'react'
import { setTransactionDisplayName } from '../../actions'

/**
 * Edit a transaction's display-name override — a safe, user-facing rename that
 * leaves the raw bank `description` (and dedup) untouched. Empty clears it.
 */
export function DisplayNameField({
  transactionId,
  initialValue,
  description,
}: {
  transactionId: string
  initialValue: string | null
  description: string
}) {
  const [value, setValue] = useState(initialValue ?? '')
  const [saved, setSaved] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const dirty = value !== (initialValue ?? '')

  const save = () =>
    startTransition(async () => {
      await setTransactionDisplayName(transactionId, value)
      setSaved(value.trim() ? 'Saved' : 'Cleared — using the original description')
    })

  return (
    <div className="grid gap-1.5 sm:col-span-2">
      <p className="text-muted-foreground text-xs">Display name</p>
      <div className="flex items-center gap-2">
        <Input
          value={value}
          placeholder={description}
          className="h-9 max-w-md"
          onChange={(e) => {
            setValue(e.target.value)
            setSaved(null)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save()
          }}
        />
        <Button size="sm" disabled={pending || !dirty} onClick={save}>
          {pending ? 'Saving…' : 'Save'}
        </Button>
        {saved ? <span className="text-success text-xs">{saved}</span> : null}
      </div>
      <p className="text-muted-foreground text-xs">
        Shown instead of the bank description in lists. Leave empty to use the original.
      </p>
    </div>
  )
}
