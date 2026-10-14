import { existsSync } from 'node:fs'
import { mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { embeddedClient } from './client'

/**
 * Whole-database snapshots of the embedded PGlite data directory.
 *
 * A snapshot is PGlite's own gzipped tarball of its data directory
 * (`dumpDataDir`), taken from the open database so it is consistent without
 * copying files a running Postgres is writing to. Snapshots live next to the data
 * directory, not inside it, so they never mix with Postgres's own files and a
 * data directory moved aside on reset or restore leaves them where they are.
 *
 * Restoring one means replacing the data directory, which can only happen while
 * the database is closed. The desktop shell does that on the next launch and
 * hands the file to `initEmbeddedDb` through `PGLITE_RESTORE_FROM`.
 */

/** How many snapshots to keep. Older ones are deleted after each new snapshot. */
export const SNAPSHOTS_TO_KEEP = 5

const SUFFIX = '.tar.gz'
/** `2026-10-14T03-15-00-000Z--before-migration.tar.gz` */
const NAME = /^(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)--([a-z0-9-]+)\.tar\.gz$/

export interface SnapshotInfo {
  /** File name, also the id passed back to restore. */
  name: string
  /** ISO timestamp the snapshot was taken. */
  createdAt: string
  /** Why it was taken, e.g. `before-migration` or `manual`. */
  reason: string
  bytes: number
}

/** The snapshot folder for a data directory, or null when the database is in memory. */
export function snapshotsDir(dataDir = process.env.PGLITE_DATA_DIR): string | null {
  if (!dataDir || dataDir.startsWith('memory://')) return null
  return `${dataDir.replace(/[\\/]+$/, '')}-snapshots`
}

function parseName(name: string): { createdAt: string; reason: string } | null {
  const match = NAME.exec(name)
  if (!match?.[1] || !match[2]) return null
  const [date, time] = match[1].split('T') as [string, string]
  const [h, m, s, ms] = time.replace('Z', '').split('-')
  return { createdAt: `${date}T${h}:${m}:${s}.${ms}Z`, reason: match[2] }
}

/**
 * The full path of a snapshot, or null when the name is not one of ours or the
 * file is missing. The name comes from the UI, so it is checked against the
 * exact pattern before it touches the filesystem.
 */
export function resolveSnapshot(name: string, dataDir?: string): string | null {
  const dir = snapshotsDir(dataDir)
  if (!dir || basename(name) !== name || !parseName(name)) return null
  const path = join(dir, name)
  return existsSync(path) ? path : null
}

/** Every snapshot for the data directory, newest first. */
export async function listSnapshots(dataDir?: string): Promise<SnapshotInfo[]> {
  const dir = snapshotsDir(dataDir)
  if (!dir || !existsSync(dir)) return []
  const out: SnapshotInfo[] = []
  for (const name of await readdir(dir)) {
    const parsed = parseName(name)
    if (!parsed) continue
    const { size } = await stat(join(dir, name))
    out.push({ name, ...parsed, bytes: size })
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

/**
 * Write a snapshot of the open database and prune old ones. Returns null when the
 * database lives in memory, where there is nothing on disk to protect.
 */
export async function createSnapshot(
  reason: string,
  dataDir?: string,
): Promise<SnapshotInfo | null> {
  const dir = snapshotsDir(dataDir)
  if (!dir) return null
  const slug =
    reason
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'manual'
  const createdAt = new Date().toISOString()
  const name = `${createdAt.replace(/[:.]/g, '-')}--${slug}${SUFFIX}`

  const blob = await embeddedClient().dumpDataDir('gzip')
  const bytes = Buffer.from(await blob.arrayBuffer())
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, name), bytes)

  const all = await listSnapshots(dataDir)
  for (const old of all.slice(SNAPSHOTS_TO_KEEP)) {
    await rm(join(dir, old.name), { force: true })
  }
  return { name, createdAt, reason: slug, bytes: bytes.length }
}
