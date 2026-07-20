'use client'

import { Button } from '@repo/ui'
import { DatabaseZap, FileText, RotateCw } from 'lucide-react'
import { useState } from 'react'
import { getDesktopBridge } from '@/lib/desktop'

/**
 * Shown when the embedded (desktop) database can't be opened — typically a corrupt
 * or unclean data directory that makes the WASM Postgres abort on boot. Unlike the
 * generic error boundary, this offers the actual recovery: reset to a fresh
 * database. The reset is destructive, so it's behind a two-step confirm; the old
 * data dir is moved aside (backed up), not deleted outright.
 */
export function DatabaseRecovery() {
  const desktop = getDesktopBridge()
  const [confirming, setConfirming] = useState(false)
  const [resetting, setResetting] = useState(false)

  const onReset = () => {
    if (!confirming) {
      setConfirming(true)
      return
    }
    setResetting(true)
    // Relaunches the app; this promise never really resolves in-page.
    desktop?.resetDatabase?.()
  }

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-5 px-6 text-center">
      <div className="flex size-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
        <DatabaseZap className="size-6" />
      </div>
      <div className="max-w-md">
        <h1 className="font-semibold text-xl tracking-tight">The local database won't open</h1>
        <p className="mt-2 text-muted-foreground text-sm">
          Your data file looks corrupt — this can happen after an unexpected shutdown or a failed
          import. Resetting starts a fresh, empty database so the app works again. Your old data
          file is moved aside (not deleted), but its contents can't be recovered by the app.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        {desktop?.resetDatabase ? (
          <Button variant="destructive" onClick={onReset} disabled={resetting} className="gap-2">
            <RotateCw className={resetting ? 'size-4 animate-spin' : 'size-4'} />
            {resetting
              ? 'Resetting…'
              : confirming
                ? 'Click again to reset — this discards local data'
                : 'Reset database'}
          </Button>
        ) : (
          <p className="text-muted-foreground text-sm">
            Restart the app to try again. If it persists, the local data file needs to be reset.
          </p>
        )}
        {desktop?.openLogs ? (
          <Button variant="ghost" onClick={() => desktop.openLogs?.()} className="gap-2">
            <FileText className="size-4" />
            Open logs
          </Button>
        ) : null}
      </div>

      {confirming && !resetting ? (
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="text-muted-foreground text-xs underline underline-offset-4 hover:text-foreground"
        >
          Cancel
        </button>
      ) : null}
    </div>
  )
}
