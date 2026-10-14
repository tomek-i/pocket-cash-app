'use server'

import type { SnapshotInfo } from '@repo/database/embedded'
import { revalidatePath } from 'next/cache'

// The snapshot helpers live on the `embedded` subpath with the migrator, so they
// are imported on demand, the same way `lib/workspace.ts` opens the database.
async function snapshots() {
  return import('@repo/database/embedded')
}

/**
 * Snapshots of the local database, newest first, and how many are kept. Empty
 * when not running embedded.
 */
export async function listDatabaseSnapshots(): Promise<{
  snapshots: SnapshotInfo[]
  keep: number
}> {
  if (process.env.DATABASE_DRIVER !== 'embedded') return { snapshots: [], keep: 0 }
  const { listSnapshots, SNAPSHOTS_TO_KEEP } = await snapshots()
  return { snapshots: await listSnapshots(), keep: SNAPSHOTS_TO_KEEP }
}

export type SnapshotResult = { ok: true; snapshot: SnapshotInfo } | { error: string }

/** Take a snapshot of the whole database now. */
export async function takeDatabaseSnapshot(): Promise<SnapshotResult> {
  if (process.env.DATABASE_DRIVER !== 'embedded') {
    return { error: 'Snapshots need the local database.' }
  }
  try {
    const { createSnapshot } = await snapshots()
    const snapshot = await createSnapshot('manual')
    if (!snapshot) return { error: 'This database is in memory, so there is nothing to snapshot.' }
    revalidatePath('/app/settings')
    return { ok: true, snapshot }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Snapshot failed' }
  }
}
