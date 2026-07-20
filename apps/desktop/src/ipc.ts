import { mkdirSync } from 'node:fs'
import { IPC, isSecretName } from '@repo/desktop-contract'
import { app, ipcMain, shell } from 'electron'
import { requestDbReset } from './db-reset'
import { logsDir } from './logging'
import { deleteSecret, hasSecret, isSecretStorageAvailable, setSecret } from './secrets'

/**
 * Register every main-process IPC handler. Channel names come from
 * @repo/desktop-contract (shared with the preload bridge + web UI), so a rename
 * can't half-apply. Call once at startup.
 */
export function registerIpcHandlers(): void {
  // Clean recovery from the renderer's error boundary: relaunch the whole app so
  // the in-process Next server + embedded database start fresh.
  ipcMain.handle(IPC.appRelaunch, () => {
    app.relaunch()
    app.exit(0)
  })

  // Open the folder holding the log file so the user can inspect / share it when a
  // page hits an error (the on-screen "Ref: <digest>" maps to a stack in that file).
  ipcMain.handle(IPC.appOpenLogs, async () => {
    try {
      mkdirSync(logsDir(), { recursive: true })
    } catch {
      // ignore — still try to open whatever exists
    }
    await shell.openPath(logsDir())
  })

  // Reset the embedded database: drop a sentinel and relaunch. The corrupt data dir
  // is moved aside on the NEXT startup, before PGlite loads (see performPendingDbReset),
  // which is the only point it can be done safely on Windows. Destructive, but the
  // data is already unreadable — this is the recovery path from a corrupt cluster.
  ipcMain.handle(IPC.dbReset, () => {
    requestDbReset()
    app.relaunch()
    app.exit(0)
  })

  // ── Secret vault (OS-keychain-backed, see secrets.ts) ──────────────────────
  // The renderer writes/checks secrets here; decrypted values stay in the main
  // process and its in-process Next server (via process.env). Reads are never
  // exposed to the renderer.
  ipcMain.handle(IPC.secretSet, (_e, name: unknown, value: unknown) => {
    if (!isSecretName(name) || typeof value !== 'string' || value.trim() === '') {
      return { ok: false, error: 'Invalid secret' }
    }
    try {
      setSecret(name, value.trim())
      return { ok: true }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Failed to store secret' }
    }
  })
  ipcMain.handle(IPC.secretDelete, (_e, name: unknown) => {
    if (!isSecretName(name)) return { ok: false }
    deleteSecret(name)
    return { ok: true }
  })
  ipcMain.handle(IPC.secretHas, (_e, name: unknown) =>
    isSecretName(name) ? hasSecret(name) : false,
  )
  ipcMain.handle(IPC.secretAvailable, () => isSecretStorageAvailable())
}
