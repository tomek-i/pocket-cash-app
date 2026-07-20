'use client'

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
import { useRouter } from 'next/navigation'
import { type ChangeEvent, useRef, useState, useTransition } from 'react'
import { exportData, importData } from '../actions'

/**
 * Back up / restore the whole workspace. Export downloads a JSON file (built by
 * the server action); import reads a chosen file, confirms (it REPLACES all data),
 * then restores it. Kept intentionally simple: two buttons + a confirm dialog.
 */
export function DataBackup() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [pending, startTransition] = useTransition()
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [pendingFile, setPendingFile] = useState<{ json: string; name: string } | null>(null)

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

  async function onFileChosen(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // let the same file be re-picked later
    if (!file) return
    setNotice(null)
    setPendingFile({ json: await file.text(), name: file.name })
  }

  function runImport() {
    if (!pendingFile) return
    const { json } = pendingFile
    setPendingFile(null)
    startTransition(async () => {
      const res = await importData(json)
      if ('error' in res) {
        setNotice({ kind: 'error', text: res.error })
        return
      }
      setNotice({ kind: 'ok', text: `Restored ${res.total} record(s) from the backup.` })
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
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

      <div className="h-px bg-border" />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-sm">Import data</p>
          <p className="text-muted-foreground text-sm">
            Restore from a backup file. This{' '}
            <span className="font-medium text-foreground">replaces all current data</span> in this
            workspace.
          </p>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={onFileChosen}
        />
        <Button
          variant="outline"
          className="shrink-0"
          disabled={pending}
          onClick={() => fileRef.current?.click()}
        >
          Import data
        </Button>
      </div>

      {notice ? (
        <p className={`text-sm ${notice.kind === 'ok' ? 'text-success' : 'text-destructive'}`}>
          {notice.text}
        </p>
      ) : null}

      <AlertDialog
        open={pendingFile != null}
        onOpenChange={(open) => {
          if (!open) setPendingFile(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore from backup?</AlertDialogTitle>
            <AlertDialogDescription>
              Importing <span className="font-medium text-foreground">{pendingFile?.name}</span>{' '}
              will permanently delete all current finance data in this workspace and replace it with
              the backup. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
            <Button variant="destructive" onClick={runImport}>
              Replace &amp; restore
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
