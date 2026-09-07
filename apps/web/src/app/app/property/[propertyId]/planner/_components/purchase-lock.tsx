'use client'

import { Button } from '@repo/ui'
import { Lock, Unlock } from 'lucide-react'
import { useActionState } from 'react'
import { completePurchase, reopenPurchase } from '../costs-actions'

/**
 * Locking a completed purchase to the rates it was calculated with.
 *
 * Until it is locked the planner follows the live schedules, which is what
 * someone still modelling a purchase wants. Once locked it reads a frozen copy,
 * so next year's rates, or a correction to this year's, cannot quietly change
 * what an already completed purchase says it cost.
 */
export function PurchaseLock({
  propertyId,
  scheduleId,
  scheduleName,
  completedAt,
  snapshotName,
}: {
  propertyId: string
  scheduleId: string | null
  scheduleName: string | null
  completedAt: Date | null
  snapshotName: string | null
}) {
  const [, completeAction, completing] = useActionState(completePurchase, null)
  const [, reopenAction, reopening] = useActionState(reopenPurchase, null)

  if (completedAt) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3">
        <div className="flex items-start gap-2.5">
          <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div>
            <p className="font-medium text-sm">Rates locked in</p>
            <p className="text-muted-foreground text-xs">
              {snapshotName
                ? `Using a frozen copy of "${snapshotName}". Later changes to that schedule will not affect this purchase.`
                : 'This purchase is complete. No rate schedule was in force when it was locked.'}
            </p>
          </div>
        </div>
        <form action={reopenAction}>
          <input type="hidden" name="id" value={propertyId} />
          <Button
            type="submit"
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={reopening}
          >
            <Unlock className="size-3.5" />
            {reopening ? 'Reopening…' : 'Reopen'}
          </Button>
        </form>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
      <div className="flex items-start gap-2.5">
        <Unlock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div>
          <p className="font-medium text-sm">Following the current rates</p>
          <p className="text-muted-foreground text-xs">
            {scheduleName
              ? `Using "${scheduleName}". Lock it in once the purchase is settled so later rate changes leave this alone.`
              : 'No rate schedule is configured for this jurisdiction.'}
          </p>
        </div>
      </div>
      <form action={completeAction}>
        <input type="hidden" name="id" value={propertyId} />
        {scheduleId ? <input type="hidden" name="scheduleId" value={scheduleId} /> : null}
        <Button type="submit" variant="outline" size="sm" className="gap-1.5" disabled={completing}>
          <Lock className="size-3.5" />
          {completing ? 'Locking…' : 'Lock in rates'}
        </Button>
      </form>
    </div>
  )
}
