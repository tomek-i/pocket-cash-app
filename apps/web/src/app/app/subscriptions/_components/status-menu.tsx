'use client'

import type { SubscriptionStatus } from '@repo/types'
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@repo/ui'
import { CirclePause, CirclePlay, CircleStop, EllipsisVertical } from 'lucide-react'
import { useTransition } from 'react'
import type { Lifecycle } from '../_lib/schedule'
import { setSubscriptionStatus } from '../actions'

/**
 * One-click status changes. A pause until a set date, or a cancellation from a
 * date other than today, goes through the edit dialog instead.
 */
export function StatusMenu({ id, state }: { id: string; state: Lifecycle }) {
  const [pending, startTransition] = useTransition()

  function change(status: SubscriptionStatus) {
    const formData = new FormData()
    formData.set('id', id)
    formData.set('status', status)
    startTransition(async () => {
      await setSubscriptionStatus(null, formData)
    })
  }

  const billing = state.kind === 'active' && !state.endsOn
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" aria-label="Change status" disabled={pending}>
            <EllipsisVertical className="size-4" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-52">
        {billing ? (
          <DropdownMenuItem onClick={() => change('paused')}>
            <CirclePause className="size-4" />
            Pause until I resume
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={() => change('active')}>
            <CirclePlay className="size-4" />
            {state.kind === 'paused'
              ? 'Resume now'
              : state.kind === 'cancelled'
                ? 'Reactivate'
                : 'Undo cancellation'}
          </DropdownMenuItem>
        )}
        {state.kind !== 'cancelled' ? (
          <DropdownMenuItem onClick={() => change('cancelled')}>
            <CircleStop className="size-4" />
            Cancel as of today
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
