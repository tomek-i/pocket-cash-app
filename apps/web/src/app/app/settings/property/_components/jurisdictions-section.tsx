'use client'

import type { Jurisdiction } from '@repo/database'
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
  Badge,
  Button,
  buttonVariants,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@repo/ui'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { type ReactElement, useActionState, useEffect, useState } from 'react'
import type { ActionState } from '@/lib/action-state'
import { Field } from '../../../banks/_components/form-field'
import { createJurisdiction, deleteJurisdiction, updateJurisdiction } from '../actions'

/**
 * Create or edit a jurisdiction.
 *
 * The `key` is what rate schedules match on, so it is shown rather than
 * generated: a user adding "United Kingdom" needs to know the schedules they
 * create must carry the same key. The transfer tax label is the whole reason
 * the engine can stay jurisdiction agnostic.
 */
function JurisdictionDialog({
  jurisdiction,
  trigger,
}: {
  jurisdiction?: Jurisdiction
  trigger: ReactElement
}) {
  const action = jurisdiction ? updateJurisdiction : createJurisdiction
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
          <DialogTitle>{jurisdiction ? 'Edit jurisdiction' : 'Add a jurisdiction'}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="grid gap-4">
          {jurisdiction ? <input type="hidden" name="id" value={jurisdiction.id} /> : null}

          <Field
            label="Name"
            name="name"
            defaultValue={state?.values?.name ?? jurisdiction?.name ?? ''}
            placeholder="United Kingdom"
            error={state?.errors?.name}
          />
          <Field
            label="Key"
            name="key"
            defaultValue={state?.values?.key ?? jurisdiction?.key ?? ''}
            placeholder="GB"
            error={state?.errors?.key}
          />
          <div className="grid gap-4 sm:grid-cols-3">
            <Field
              label="Country"
              name="country"
              defaultValue={state?.values?.country ?? jurisdiction?.country ?? ''}
              placeholder="GB"
              error={state?.errors?.country}
            />
            <Field
              label="Region"
              name="region"
              defaultValue={state?.values?.region ?? jurisdiction?.region ?? ''}
              placeholder="ENG"
              error={state?.errors?.region}
            />
            <Field
              label="Currency"
              name="currency"
              defaultValue={state?.values?.currency ?? jurisdiction?.currency ?? ''}
              placeholder="GBP"
              error={state?.errors?.currency}
            />
          </div>
          <Field
            label="What the purchase tax is called here"
            name="transferTaxLabel"
            defaultValue={state?.values?.transferTaxLabel ?? jurisdiction?.transferTaxLabel ?? ''}
            placeholder="Stamp Duty Land Tax"
            error={state?.errors?.transferTaxLabel}
          />

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : jurisdiction ? 'Save changes' : 'Add jurisdiction'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DeleteJurisdictionDialog({ jurisdiction }: { jurisdiction: Jurisdiction }) {
  const [, formAction] = useActionState(deleteJurisdiction, null)
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button variant="ghost" size="icon" aria-label={`Delete ${jurisdiction.name}`}>
            <Trash2 className="size-4" />
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{jurisdiction.name}”?</AlertDialogTitle>
          <AlertDialogDescription>
            This also deletes every rate schedule under it. Properties using this jurisdiction are
            kept, but lose their rules until you assign another.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <form action={formAction}>
          <input type="hidden" name="id" value={jurisdiction.id} />
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

export function JurisdictionsSection({ jurisdictions }: { jurisdictions: Jurisdiction[] }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-muted-foreground text-sm">
            {jurisdictions.length} configured. Each decides its own rules and terminology.
          </p>
          <JurisdictionDialog
            trigger={
              <Button variant="outline" size="sm" className="gap-1.5">
                <Plus className="size-4" />
                Add jurisdiction
              </Button>
            }
          />
        </div>

        <div className="flex flex-col border-t">
          {jurisdictions.map((jurisdiction) => (
            <div
              key={jurisdiction.id}
              className="flex flex-wrap items-center justify-between gap-3 border-b py-3 last:border-b-0"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{jurisdiction.name}</p>
                  <Badge variant="outline" className="text-[10px]">
                    {jurisdiction.key}
                  </Badge>
                  {jurisdiction.isSystem ? (
                    <Badge variant="outline" className="text-[10px]">
                      Built in
                    </Badge>
                  ) : null}
                </div>
                <p className="text-muted-foreground text-xs">
                  {jurisdiction.currency} · calls its purchase tax “{jurisdiction.transferTaxLabel}”
                </p>
              </div>
              <div className="flex items-center gap-1">
                <JurisdictionDialog
                  jurisdiction={jurisdiction}
                  trigger={
                    <Button variant="ghost" size="icon" aria-label={`Edit ${jurisdiction.name}`}>
                      <Pencil className="size-4" />
                    </Button>
                  }
                />
                <DeleteJurisdictionDialog jurisdiction={jurisdiction} />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
