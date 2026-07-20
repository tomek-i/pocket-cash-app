import { eq } from 'drizzle-orm'
import { db } from './client'
import { type AppSettings, appSettings } from './schema'

/**
 * The app's settings are a single row (this is a single-user, local app). These
 * helpers read and upsert that row so callers never worry about the id or whether
 * the row exists yet.
 */
const SETTINGS_ID = 'app'

/** Current settings, or an empty object if nothing has been saved yet. */
export async function getAppSettings(): Promise<AppSettings> {
  const row = await db.query.appSettings.findFirst({
    where: eq(appSettings.id, SETTINGS_ID),
  })
  return row?.settings ?? {}
}

/** Persist the settings blob (creating the row on first write). */
export async function saveAppSettings(next: AppSettings): Promise<void> {
  await db
    .insert(appSettings)
    .values({ id: SETTINGS_ID, settings: next, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: appSettings.id,
      set: { settings: next, updatedAt: new Date() },
    })
}
