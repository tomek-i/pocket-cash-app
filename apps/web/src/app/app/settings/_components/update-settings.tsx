'use client'

import { Button, Card, CardContent } from '@repo/ui'
import { useEffect, useState, useTransition } from 'react'
import {
  type DesktopUpdates,
  getDesktopBridge,
  type UpdateCheckResult,
  type UpdateStatus,
} from '@/lib/desktop'

/**
 * Update settings for the desktop app. The shell owns both the setting (stored
 * outside the database, see apps/desktop/src/preferences.ts) and the check, so
 * this renders nothing in a plain browser.
 */
export function UpdateSettings() {
  const [updates, setUpdates] = useState<DesktopUpdates | null>(null)
  const [status, setStatus] = useState<UpdateStatus | null>(null)
  const [result, setResult] = useState<UpdateCheckResult | null>(null)
  const [saving, startSaving] = useTransition()
  const [checking, startCheck] = useTransition()

  useEffect(() => {
    const bridge = getDesktopBridge()?.updates
    if (!bridge) return
    setUpdates(bridge)
    bridge.status().then(setStatus)
  }, [])

  if (!updates || !status) return null

  const toggle = (enabled: boolean) =>
    startSaving(async () => {
      setStatus(await updates.setAutoCheck(enabled))
    })

  const checkNow = () =>
    startCheck(async () => {
      setResult(null)
      setResult(await updates.check())
    })

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="font-semibold text-lg">Updates</h2>
        <p className="text-muted-foreground text-sm">
          The only thing Pocket Cash checks online. It reads the list of releases on GitHub and
          sends nothing about you or your data.
        </p>
      </div>
      <Card>
        <CardContent className="flex flex-col gap-4 p-5">
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-primary"
              checked={status.autoCheck}
              disabled={saving}
              onChange={(e) => toggle(e.target.checked)}
            />
            <span>
              <span className="font-medium">Check for updates when Pocket Cash starts</span>
              <span className="block text-muted-foreground">
                {status.canInstall
                  ? 'You are asked before anything is downloaded or installed.'
                  : 'This copy cannot update itself (portable, zip or macOS build), so you get a link to download the new version.'}
              </span>
            </span>
          </label>

          <div className="h-px bg-border" />

          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm">Version {status.currentVersion}</p>
              <ResultText status={status} result={result} />
            </div>
            <Button
              variant="outline"
              className="shrink-0"
              disabled={checking || !status.supported}
              onClick={checkNow}
            >
              {checking ? 'Checking…' : 'Check now'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  )
}

function ResultText({
  status,
  result,
}: {
  status: UpdateStatus
  result: UpdateCheckResult | null
}) {
  if (!status.supported) {
    return (
      <p className="text-muted-foreground text-sm">
        Updates are only available in the installed app.
      </p>
    )
  }
  if (!result) return null
  switch (result.status) {
    case 'up-to-date':
      return <p className="text-sm text-success">You have the latest version.</p>
    case 'available':
      return <p className="text-sm">Version {result.version} is available.</p>
    case 'unsupported':
      return (
        <p className="text-muted-foreground text-sm">
          Updates are only available in the installed app.
        </p>
      )
    case 'error':
      return <p className="text-destructive text-sm">Could not check for updates: {result.error}</p>
  }
}
