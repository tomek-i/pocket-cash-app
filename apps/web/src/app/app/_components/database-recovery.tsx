'use client'

import type { SnapshotInfo } from '@repo/database/embedded'
import { Button } from '@repo/ui'
import { DatabaseZap, FileText, History, RotateCw } from 'lucide-react'
import { useState } from 'react'
import { getDesktopBridge } from '@/lib/desktop'
import { formatSnapshotDate } from '../settings/_components/database-snapshots'

/**
 * Shown when the embedded (desktop) database can't be opened, in place of the
 * generic error boundary, because it offers the actual recovery.
 *
 * - `corrupt`: the data directory won't boot, typically after an unclean
 *   shutdown. Restoring the latest snapshot is offered first; resetting to an
 *   empty database is the last resort.
 * - `update-failed`: the database opened but bringing it up to date failed. The
 *   migrations run in one transaction, so the data is unchanged and the previous
 *   version of the app still works with it. That is the way back. A reset is NOT
 *   offered (the bug is ours, not the data's), and neither is a restore: the same
 *   version would fail on the restored copy in exactly the same way.
 *
 * Both destructive actions move the current data directory aside rather than
 * deleting it.
 */
export function DatabaseRecovery({
  kind,
  latestSnapshot,
}: {
  kind: 'corrupt' | 'update-failed'
  latestSnapshot: Pick<SnapshotInfo, 'name' | 'createdAt'> | null
}) {
  const desktop = getDesktopBridge()
  const [confirming, setConfirming] = useState<'reset' | 'restore' | null>(null)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canRestore = kind === 'corrupt' && Boolean(latestSnapshot && desktop?.restoreSnapshot)
  const canReset = kind === 'corrupt' && Boolean(desktop?.resetDatabase)

  const onRestore = async () => {
    if (confirming !== 'restore') {
      setConfirming('restore')
      return
    }
    if (!latestSnapshot) return
    setWorking(true)
    setError(null)
    // Relaunches the app on success; this only returns when it failed.
    const res = await desktop?.restoreSnapshot?.(latestSnapshot.name)
    if (res && !res.ok) {
      setWorking(false)
      setConfirming(null)
      setError(res.error)
    }
  }

  const onReset = () => {
    if (confirming !== 'reset') {
      setConfirming('reset')
      return
    }
    setWorking(true)
    // Relaunches the app; this promise never really resolves in-page.
    desktop?.resetDatabase?.()
  }

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-5 px-6 text-center">
      <div className="flex size-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
        <DatabaseZap className="size-6" />
      </div>
      <div className="max-w-md">
        <h1 className="font-semibold text-xl tracking-tight">
          {kind === 'corrupt'
            ? "The local database won't open"
            : "The local database couldn't be updated"}
        </h1>
        <p className="mt-2 text-muted-foreground text-sm">
          {kind === 'corrupt'
            ? 'Your data file looks corrupt. This can happen after an unexpected shutdown.'
            : 'This version of the app needs to update your database, and the update failed. Your data was not changed, so the previous version of the app still works with it. Please install that version for now and send the logs with a bug report.'}
          {canRestore && latestSnapshot
            ? ` A snapshot from ${formatSnapshotDate(latestSnapshot.createdAt)} is available.`
            : ''}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        {canRestore ? (
          <Button onClick={onRestore} disabled={working} className="gap-2">
            <History className="size-4" />
            {confirming === 'restore'
              ? working
                ? 'Restoring…'
                : 'Click again to restore and restart'
              : 'Restore snapshot'}
          </Button>
        ) : null}
        {canReset ? (
          <Button variant="destructive" onClick={onReset} disabled={working} className="gap-2">
            <RotateCw
              className={working && confirming === 'reset' ? 'size-4 animate-spin' : 'size-4'}
            />
            {confirming === 'reset'
              ? working
                ? 'Resetting…'
                : 'Click again to reset. This starts an empty database'
              : 'Reset database'}
          </Button>
        ) : null}
        {!canRestore && !canReset ? (
          <p className="text-muted-foreground text-sm">
            Restart the app to try again. If it persists, send the logs with a bug report.
          </p>
        ) : null}
        {desktop?.relaunch ? (
          <Button variant="ghost" onClick={() => desktop.relaunch?.()} className="gap-2">
            <RotateCw className="size-4" />
            Restart
          </Button>
        ) : null}
        {desktop?.openLogs ? (
          <Button variant="ghost" onClick={() => desktop.openLogs?.()} className="gap-2">
            <FileText className="size-4" />
            Open logs
          </Button>
        ) : null}
      </div>

      {confirming && !working ? (
        <button
          type="button"
          onClick={() => setConfirming(null)}
          className="text-muted-foreground text-xs underline underline-offset-4 hover:text-foreground"
        >
          Cancel
        </button>
      ) : null}
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
    </div>
  )
}
