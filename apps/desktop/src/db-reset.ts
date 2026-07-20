import { existsSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import { logStartup } from './logging'

// A corrupt/unclean PGlite data dir (e.g. left after a crash mid-write) makes the
// WASM Postgres abort on boot — the whole app is then stuck on an error screen.
// The recovery is to move that dir aside and let a fresh cluster bootstrap. The
// renderer requests it (see the db:reset IPC) by dropping a sentinel and
// relaunching; the ACTUAL move happens at the very start of a fresh process
// BEFORE the in-process server (and thus PGlite) loads — so nothing holds a handle
// on the directory and the rename can't fail on open files (a real risk on Windows).

function resetSentinelPath(): string {
  return join(app.getPath('userData'), '.reset-db')
}

/** Drop the sentinel that triggers a data-dir reset on the next launch. */
export function requestDbReset(): void {
  try {
    writeFileSync(resetSentinelPath(), `requested ${new Date().toISOString()}\n`)
    logStartup('DB reset requested — relaunching')
  } catch (error) {
    logStartup(`DB reset request FAILED to write sentinel: ${String(error)}`)
  }
}

/**
 * If a reset was requested last session, move the corrupt data dir aside NOW —
 * called before the server (and PGlite) load, the only point it can be done
 * safely on Windows.
 */
export function performPendingDbReset(dataDir: string): void {
  const sentinel = resetSentinelPath()
  if (!existsSync(sentinel)) return
  try {
    if (existsSync(dataDir)) {
      // Keep a single timestamped backup rather than deleting outright — the data
      // is unreadable, but a savvy user might still salvage something from it.
      const backup = `${dataDir}.corrupt-${Date.now()}`
      renameSync(dataDir, backup)
      logStartup(`DB reset: moved ${dataDir} → ${backup}`)
    } else {
      logStartup('DB reset: no data dir to move (fresh start)')
    }
  } catch (error) {
    logStartup(`DB reset FAILED: ${error instanceof Error ? error.stack : String(error)}`)
  } finally {
    try {
      rmSync(sentinel, { force: true })
    } catch {
      // ignore — a leftover sentinel would just trigger a harmless no-op reset
    }
  }
}
