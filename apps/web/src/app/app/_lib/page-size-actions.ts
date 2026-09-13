'use server'

import { getAppSettings, saveAppSettings } from '@repo/database'
import { type PageSize, toPageSize } from './pagination'

/**
 * Remember the rows-per-page the user picked.
 *
 * Split from navigation on purpose: the URL stays the single source of truth for
 * what is on screen, and this only records what to default to next time. So a
 * link someone shares still shows what they were looking at, rather than
 * whatever page size the person opening it happens to prefer.
 */
export async function savePageSizePreference(size: PageSize): Promise<void> {
  const settings = await getAppSettings()
  await saveAppSettings({ ...settings, transactionsPageSize: toPageSize(size) })
}
