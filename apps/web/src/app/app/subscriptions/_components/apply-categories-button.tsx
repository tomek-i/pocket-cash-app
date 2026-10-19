'use client'

import { Button } from '@repo/ui'
import { Shapes } from 'lucide-react'
import { useState, useTransition } from 'react'
import { applyCategoriesNow } from '../actions'

/**
 * Saving a subscription and importing a file already do this. The button is for
 * charges imported before their subscription had a category.
 */
export function ApplyCategoriesButton() {
  const [pending, startTransition] = useTransition()
  const [changed, setChanged] = useState<number | null>(null)

  return (
    <div className="flex items-center gap-2">
      {changed !== null ? (
        <span className="text-muted-foreground text-xs">
          {changed === 0
            ? 'Everything already matches.'
            : `Updated ${changed} transaction${changed === 1 ? '' : 's'}.`}
        </span>
      ) : null}
      <Button
        variant="ghost"
        size="sm"
        className="gap-2"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setChanged((await applyCategoriesNow()).changed)
          })
        }
      >
        <Shapes className="size-4" />
        {pending ? 'Applying…' : 'Apply categories to transactions'}
      </Button>
    </div>
  )
}
