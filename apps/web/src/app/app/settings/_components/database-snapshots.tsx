'use client'

import type { SnapshotInfo } from '@repo/database/embedded'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
} from '@repo/ui'
import { useState, useTransition } from 'react'
import { getDesktopBridge } from '@/lib/desktop'
import { takeDatabaseSnapshot } from '../snapshot-actions'

const REASONS: Record<string, string> = {
  'before-migration': 'Before an update to the database',
  manual: 'Taken by you',
}

export function formatSnapshotDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/**
 * Whole-database snapshots: taken automatically before the app changes the
 * database schema, or by hand. Restoring one replaces everything, including
 * property plans and settings, and restarts the app.
 */
export function DatabaseSnapshots({
  snapshots,
  keep,
}: {
  snapshots: SnapshotInfo[]
  /** How many snapshots are kept before the oldest is deleted. */
  keep: number
}) {
  const desktop = getDesktopBridge()
  const canRestore = Boolean(desktop?.restoreSnapshot)
  const [pending, startTransition] = useTransition()
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [restoring, setRestoring] = useState<SnapshotInfo | null>(null)
  const [restartingWith, setRestartingWith] = useState<string | null>(null)

  const take = () =>
    startTransition(async () => {
      setNotice(null)
      const res = await takeDatabaseSnapshot()
      if ('error' in res) setNotice({ kind: 'error', text: res.error })
      else setNotice({ kind: 'ok', text: 'Snapshot saved.' })
    })

  const restore = (snapshot: SnapshotInfo) =>
    startTransition(async () => {
      setNotice(null)
      setRestartingWith(snapshot.name)
      // On success the app relaunches and this never returns.
      const res = await desktop?.restoreSnapshot?.(snapshot.name)
      if (res && !res.ok) {
        setRestartingWith(null)
        setRestoring(null)
        setNotice({ kind: 'error', text: res.error })
      }
    })

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm">Snapshots</p>
          <p className="text-muted-foreground text-sm">
            A copy of the whole database, taken before each update that changes it. The last {keep}{' '}
            are kept. Restoring one replaces everything, including property plans.
          </p>
        </div>
        <Button variant="outline" className="shrink-0" disabled={pending} onClick={take}>
          {pending && !restartingWith ? 'Working…' : 'Take snapshot'}
        </Button>
      </div>

      {snapshots.length === 0 ? (
        <p className="text-muted-foreground text-sm">No snapshots yet.</p>
      ) : (
        <ul className="flex list-none flex-col divide-y rounded-lg border p-0">
          {snapshots.map((s) => (
            <li key={s.name} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm">{formatSnapshotDate(s.createdAt)}</p>
                <p className="text-muted-foreground text-xs">
                  {REASONS[s.reason] ?? s.reason} · {formatSize(s.bytes)}
                </p>
              </div>
              {canRestore ? (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() => setRestoring(s)}
                >
                  Restore
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {!canRestore && snapshots.length > 0 ? (
        <p className="text-muted-foreground text-xs">Restoring is available in the desktop app.</p>
      ) : null}

      {notice ? (
        <p className={`text-sm ${notice.kind === 'ok' ? 'text-success' : 'text-destructive'}`}>
          {notice.text}
        </p>
      ) : null}

      <AlertDialog open={restoring !== null} onOpenChange={(open) => !open && setRestoring(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore this snapshot?</AlertDialogTitle>
            <AlertDialogDescription>
              Everything goes back to how it was on{' '}
              {restoring ? formatSnapshotDate(restoring.createdAt) : ''}. Changes made since then
              are set aside, not deleted: the current database is moved to a folder next to it. The
              app restarts to finish.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button" disabled={restartingWith !== null}>
              Cancel
            </AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={restartingWith !== null}
              onClick={() => restoring && restore(restoring)}
            >
              {restartingWith ? 'Restarting…' : 'Restore and restart'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
