'use client'

import { createLogger } from '@repo/logger'
import { Button } from '@repo/ui'
import { FileText, RotateCw, TriangleAlert } from 'lucide-react'
import { useEffect } from 'react'
import { getDesktopBridge } from '@/lib/desktop'

const log = createLogger('app')

/**
 * Error boundary for the /app area. It renders INSIDE the app layout, so the
 * sidebar stays usable — a crashed page never traps the user. `reset()` re-runs
 * the failed segment (recovers transient errors). For harder failures the
 * fallback differs by environment: on the desktop the Next server + embedded DB
 * run in-process, so a full app relaunch is the clean reset; on web a reload
 * suffices.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    log.error('unhandled error in /app segment', { err: error, digest: error.digest })
  }, [error])

  const desktop = getDesktopBridge()

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex size-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
        <TriangleAlert className="size-6" />
      </div>
      <div className="max-w-md">
        <h1 className="font-semibold text-xl tracking-tight">Something went wrong</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          This page hit an unexpected error. Try again, or use the sidebar to go elsewhere. If it
          keeps happening, reload the app.
        </p>
        {error.digest ? (
          <p className="mt-2 font-mono text-muted-foreground text-xs">Ref: {error.digest}</p>
        ) : null}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={() => reset()} className="gap-2">
          <RotateCw className="size-4" />
          Try again
        </Button>
        {desktop?.isElectron ? (
          <>
            <Button variant="outline" onClick={() => desktop.relaunch?.()}>
              Restart app
            </Button>
            {desktop.openLogs ? (
              <Button variant="ghost" onClick={() => desktop.openLogs?.()} className="gap-2">
                <FileText className="size-4" />
                Open logs
              </Button>
            ) : null}
          </>
        ) : (
          <Button variant="outline" onClick={() => window.location.reload()}>
            Reload app
          </Button>
        )}
      </div>
    </div>
  )
}
