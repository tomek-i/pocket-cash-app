'use server'

import { db } from '@repo/database'
import { revalidatePath } from 'next/cache'
import type { DangerResult } from '../settings/actions'
import { seedDemoData, wipeAllFinanceData } from './seed'

/** Every /app view that reflects finance data, revalidated after a bulk change. */
const REVALIDATE_PATHS = [
  '/app',
  '/app/banks',
  '/app/accounts',
  '/app/transactions',
  '/app/subscriptions',
  '/app/categories',
  '/app/tags',
]

/**
 * Wipe ALL finance data and replace it with the demo dataset, in one transaction.
 * Used by Settings → "Reset & load demo data". `deleted` carries the number of
 * demo transactions loaded so the confirm dialog can report it.
 */
export async function resetAndSeedDemo(): Promise<DangerResult> {
  try {
    const seeded = await db.transaction(async (tx) => {
      await wipeAllFinanceData(tx)
      return seedDemoData(tx, new Date())
    })
    for (const path of REVALIDATE_PATHS) revalidatePath(path)
    return { ok: true, deleted: seeded }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Could not load demo data' }
  }
}
