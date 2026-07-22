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
import { importData } from '../actions'

/**
 * Restore the whole workspace from a backup file. This is destructive — it
 * REPLACES all current data — so it lives in the Danger zone. Reads the chosen
 * file, confirms via dialog, then restores it.
 */
export function ImportData() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [pending, startTransition] = useTransition()
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [pendingFile, setPendingFile] = useState<{ json: string; name: string } | null>(null)

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
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0 flex-1">
        <p className="font-medium text-sm">Import data</p>
        <p className="text-muted-foreground text-sm">
          Restore from a backup file. This{' '}
          <span className="font-medium text-foreground">replaces all current data</span> in this
          workspace.
        </p>
        {notice ? (
          <p
            className={`mt-1 text-sm ${notice.kind === 'ok' ? 'text-success' : 'text-destructive'}`}
          >
            {notice.text}
          </p>
        ) : null}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={onFileChosen}
      />
      <Button
        variant="destructive"
        className="shrink-0"
        disabled={pending}
        onClick={() => fileRef.current?.click()}
      >
        {pending ? 'Working…' : 'Import data'}
      </Button>

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
