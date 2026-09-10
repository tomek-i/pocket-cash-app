'use client'

import type { Jurisdiction, RateScheduleRow } from '@repo/database'
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
} from '@repo/ui'
import { Copy, Pencil, Plus, Trash2 } from 'lucide-react'
import { useActionState } from 'react'
import { deleteRateSchedule, duplicateRateSchedule, toggleRateSchedule } from '../schedules-actions'
import { ScheduleEditor } from './schedule-editor'

function DeleteScheduleDialog({ schedule }: { schedule: RateScheduleRow }) {
  const [, formAction] = useActionState(deleteRateSchedule, null)
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button variant="ghost" size="icon" aria-label={`Delete ${schedule.name}`}>
            <Trash2 className="size-4" />
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{schedule.name}”?</AlertDialogTitle>
          <AlertDialogDescription>
            Purchases already locked in keep their own frozen copy of these rates, so their figures
            do not change. Anything still following the current rates will fall back to another
            schedule, or to none.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <form action={formAction}>
          <input type="hidden" name="id" value={schedule.id} />
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

function ScheduleRow({
  schedule,
  jurisdictions,
  locale,
}: {
  schedule: RateScheduleRow
  jurisdictions: Jurisdiction[]
  locale: string
}) {
  const [, toggleAction] = useActionState(toggleRateSchedule, null)
  const [, duplicateAction] = useActionState(duplicateRateSchedule, null)

  const period = schedule.effectiveTo
    ? `${schedule.effectiveFrom} to ${schedule.effectiveTo}`
    : `${schedule.effectiveFrom} onwards`

  return (
    <div
      className={
        schedule.enabled
          ? 'flex flex-wrap items-center justify-between gap-3 border-b py-3 last:border-b-0'
          : 'flex flex-wrap items-center justify-between gap-3 border-b py-3 opacity-55 last:border-b-0'
      }
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium">{schedule.name}</p>
          <Badge variant="outline" className="text-[10px]">
            v{schedule.version}
          </Badge>
          {schedule.isSystem ? (
            <Badge variant="outline" className="text-[10px]">
              Built in
            </Badge>
          ) : null}
          {!schedule.enabled ? (
            <Badge variant="secondary" className="text-[10px]">
              Disabled
            </Badge>
          ) : null}
        </div>
        <p className="text-muted-foreground text-xs">
          {period} · {schedule.brackets.length} bracket
          {schedule.brackets.length === 1 ? '' : 's'} · {schedule.groupKey}
        </p>
      </div>

      <div className="flex items-center gap-1">
        <form action={toggleAction}>
          <input type="hidden" name="id" value={schedule.id} />
          <input type="hidden" name="enabled" value={schedule.enabled ? 'false' : 'true'} />
          <Button type="submit" variant="ghost" size="sm">
            {schedule.enabled ? 'Disable' : 'Enable'}
          </Button>
        </form>

        <form action={duplicateAction}>
          <input type="hidden" name="id" value={schedule.id} />
          <Button
            type="submit"
            variant="ghost"
            size="icon"
            aria-label={`Duplicate ${schedule.name}`}
            title="Duplicate for a new period"
          >
            <Copy className="size-4" />
          </Button>
        </form>

        <ScheduleEditor
          schedule={schedule}
          jurisdictions={jurisdictions}
          locale={locale}
          trigger={
            <Button variant="ghost" size="icon" aria-label={`Edit ${schedule.name}`}>
              <Pencil className="size-4" />
            </Button>
          }
        />

        <DeleteScheduleDialog schedule={schedule} />
      </div>
    </div>
  )
}

export function RateSchedulesSection({
  schedules,
  jurisdictions,
  locale,
}: {
  schedules: RateScheduleRow[]
  jurisdictions: Jurisdiction[]
  locale: string
}) {
  const byJurisdiction = schedules.reduce<Record<string, RateScheduleRow[]>>((groups, schedule) => {
    groups[schedule.jurisdictionKey] = groups[schedule.jurisdictionKey] ?? []
    groups[schedule.jurisdictionKey]?.push(schedule)
    return groups
  }, {})

  const nameFor = (key: string) => jurisdictions.find((j) => j.key === key)?.name ?? key

  return (
    <Card>
      <CardContent className="flex flex-col gap-5 p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-muted-foreground text-sm">
            {schedules.length} schedule{schedules.length === 1 ? '' : 's'}. Duplicate one to start a
            new period rather than editing the old rates.
          </p>
          <ScheduleEditor
            jurisdictions={jurisdictions}
            locale={locale}
            trigger={
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={jurisdictions.length === 0}
              >
                <Plus className="size-4" />
                Add schedule
              </Button>
            }
          />
        </div>

        {schedules.length === 0 ? (
          <p className="py-6 text-center text-muted-foreground text-sm">
            No rate schedules yet. Add one to have a bracketed cost calculate automatically.
          </p>
        ) : (
          Object.entries(byJurisdiction).map(([key, group]) => (
            <div key={key} className="flex flex-col gap-1">
              <p className="font-medium text-muted-foreground text-sm">{nameFor(key)}</p>
              <div className="flex flex-col border-t">
                {group.map((schedule) => (
                  <ScheduleRow
                    key={schedule.id}
                    schedule={schedule}
                    jurisdictions={jurisdictions}
                    locale={locale}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
