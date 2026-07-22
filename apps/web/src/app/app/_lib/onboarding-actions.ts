'use server'

import { db, getAppSettings, saveAppSettings } from '@repo/database'
import { revalidatePath } from 'next/cache'
import { seedDemoData } from './seed'

export type OnboardingChoice = 'demo' | 'clean'

/**
 * Finish the first-run welcome tour. "demo" loads the sample dataset; "clean"
 * leaves the workspace empty. Either way the completion flag is persisted so the
 * tour never shows again, and the /app layout is revalidated to drop the overlay.
 */
export async function completeOnboarding(choice: OnboardingChoice): Promise<{ ok: true }> {
  if (choice === 'demo') {
    await db.transaction(async (tx) => {
      await seedDemoData(tx, new Date())
    })
  }

  const current = await getAppSettings()
  await saveAppSettings({ ...current, onboardingCompleted: true })

  // The gate lives in the /app layout — revalidate the whole segment so it
  // re-reads the flag and renders the app instead of the tour.
  revalidatePath('/app', 'layout')
  return { ok: true }
}
