import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { app } from 'electron'

/**
 * Settings that belong to the desktop shell rather than the workspace. They live
 * in a small JSON file under the per-user data dir, not in the embedded database,
 * because the main process needs them before (or without) the Next server, and
 * they describe this install, not the user's finances. A backup/restore of the
 * database leaves them alone on purpose.
 */
export interface Preferences {
  /** Check GitHub for a newer release on launch. */
  autoUpdateCheck: boolean
}

const DEFAULTS: Preferences = {
  autoUpdateCheck: true,
}

function preferencesPath(): string {
  return join(app.getPath('userData'), 'preferences.json')
}

export function readPreferences(): Preferences {
  const path = preferencesPath()
  if (!existsSync(path)) return { ...DEFAULTS }
  try {
    const stored = JSON.parse(readFileSync(path, 'utf8')) as Partial<Preferences>
    return {
      autoUpdateCheck:
        typeof stored.autoUpdateCheck === 'boolean'
          ? stored.autoUpdateCheck
          : DEFAULTS.autoUpdateCheck,
    }
  } catch {
    // A corrupt file falls back to the defaults rather than blocking startup.
    return { ...DEFAULTS }
  }
}

export function writePreferences(patch: Partial<Preferences>): Preferences {
  const next = { ...readPreferences(), ...patch }
  const path = preferencesPath()
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(next, null, 2), 'utf8')
  return next
}
