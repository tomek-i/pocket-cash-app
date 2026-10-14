import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
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

// ── Restore from a snapshot ─────────────────────────────────────────────────
// Same shape as the reset: the request is a sentinel holding the snapshot path,
// and the swap happens at the start of the next launch while nothing has the
// data directory open. Snapshots are written by @repo/database next to the data
// directory, in `<dataDir>-snapshots`.

/** Matches the names @repo/database gives snapshots (see snapshots.ts there). */
const SNAPSHOT_NAME = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z--[a-z0-9-]+\.tar\.gz$/

function restoreSentinelPath(): string {
  return join(app.getPath('userData'), '.restore-db')
}

/**
 * The full path of a named snapshot, or null when the name is not a snapshot or
 * the file is missing. The name comes from the renderer, so it is checked
 * against the exact pattern before it touches the filesystem.
 */
export function resolveSnapshotPath(dataDir: string, name: string): string | null {
  if (basename(name) !== name || !SNAPSHOT_NAME.test(name)) return null
  const path = join(`${dataDir.replace(/[\\/]+$/, '')}-snapshots`, name)
  return existsSync(path) ? path : null
}

/** Ask for the database to be restored from `snapshotPath` on the next launch. */
export function requestDbRestore(snapshotPath: string): void {
  writeFileSync(restoreSentinelPath(), snapshotPath)
  logStartup(`DB restore requested from ${snapshotPath} — relaunching`)
}

/**
 * If a restore was requested, move the current data directory aside and point
 * the embedded database at the snapshot. Called before the server (and PGlite)
 * load. The old directory is kept, renamed, so a restore can itself be undone by
 * hand. PGlite unpacks the snapshot when it creates the new directory.
 */
export function performPendingDbRestore(dataDir: string): void {
  const sentinel = restoreSentinelPath()
  if (!existsSync(sentinel)) return
  try {
    const snapshotPath = readFileSync(sentinel, 'utf8').trim()
    if (!existsSync(snapshotPath)) {
      logStartup(`DB restore skipped: snapshot ${snapshotPath} is missing`)
      return
    }
    if (existsSync(dataDir)) {
      const aside = `${dataDir}.before-restore-${Date.now()}`
      renameSync(dataDir, aside)
      logStartup(`DB restore: moved ${dataDir} → ${aside}`)
    }
    process.env.PGLITE_RESTORE_FROM = snapshotPath
    logStartup(`DB restore: loading ${snapshotPath}`)
  } catch (error) {
    logStartup(`DB restore FAILED: ${error instanceof Error ? error.stack : String(error)}`)
  } finally {
    try {
      rmSync(sentinel, { force: true })
    } catch {
      // ignore — the restore only runs if the snapshot still exists
    }
  }
}
