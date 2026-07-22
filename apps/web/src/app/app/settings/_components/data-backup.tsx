'use client'

import { Button } from '@repo/ui'
import { useState, useTransition } from 'react'
import { exportData } from '../actions'

/**
 * Export the whole workspace to a single JSON file (built by the server action,
 * downloaded in the browser). Restore lives in the Danger zone — see
 * {@link ../_components/import-data.ImportData} — because it replaces all data.
 */
export function DataBackup() {
  const [pending, startTransition] = useTransition()
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  function runExport() {
    setNotice(null)
    startTransition(async () => {
      const res = await exportData()
      if ('error' in res) {
        setNotice({ kind: 'error', text: res.error })
        return
      }
      // Trigger a browser download of the returned JSON.
      const url = URL.createObjectURL(new Blob([res.json], { type: 'application/json' }))
      const a = document.createElement('a')
      a.href = url
      a.download = res.filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      setNotice({ kind: 'ok', text: `Downloaded ${res.filename}.` })
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm">Export data</p>
          <p className="text-muted-foreground text-sm">
            Download a full backup — banks, accounts, transactions, categories, tags and
            subscriptions — as a single JSON file.
          </p>
        </div>
        <Button variant="outline" className="shrink-0" disabled={pending} onClick={runExport}>
          {pending ? 'Working…' : 'Export data'}
        </Button>
      </div>

      {notice ? (
        <p className={`text-sm ${notice.kind === 'ok' ? 'text-success' : 'text-destructive'}`}>
          {notice.text}
        </p>
      ) : null}
    </div>
  )
}
