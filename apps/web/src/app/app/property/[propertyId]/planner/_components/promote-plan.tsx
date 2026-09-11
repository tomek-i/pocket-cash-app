'use client'

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
} from '@repo/ui'
import { useActionState, useEffect, useState } from 'react'
import { promotePlan } from '../../../actions'

/**
 * Turn a plan into a property you are actually pursuing.
 *
 * Only the status and the name move. Everything modelled on the plan is already
 * attached to this row, so nothing is copied and nothing is lost: the loan, the
 * costs, the scenarios and the rate schedule it was calculated against all carry
 * straight over.
 *
 * The name is asked for here rather than at the start, because the moment a plan
 * stops being a what-if and becomes a particular house is exactly the moment it
 * earns one.
 */
export function PromotePlan({ propertyId, name }: { propertyId: string; name: string }) {
  const [state, formAction, pending] = useActionState(promotePlan, null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (state?.ok) setOpen(false)
  }, [state])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            Make this a property
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Make this a property</DialogTitle>
          <DialogDescription>
            Everything you have modelled here comes with it: the loan, the costs, the scenarios and
            the rates it was calculated against. It moves out of Plans and into Planned purchase.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={propertyId} />
          <div className="grid gap-1.5">
            <Label htmlFor="promote-name">Name</Label>
            <Input
              id="promote-name"
              name="name"
              defaultValue={name === 'Untitled plan' ? '' : name}
              placeholder="12 Harbour Street"
            />
            {state?.errors?.name?.[0] ? (
              <p className="text-destructive text-xs">{state.errors.name[0]}</p>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : 'Make it a property'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
