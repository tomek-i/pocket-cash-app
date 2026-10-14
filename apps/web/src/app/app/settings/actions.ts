'use server'

import { type AiConfig, isAiEnabled, pingModel } from '@repo/ai'
import {
  type AiSettings,
  buildBackup,
  csvImports,
  db,
  getAppSettings,
  parseBackup,
  restoreBackup,
  saveAppSettings,
  transactions,
} from '@repo/database'
import { updateSettingsSchema } from '@repo/validation'
import { revalidatePath } from 'next/cache'
import type { ActionState } from '@/lib/action-state'
import { wipeAllFinanceData } from '../_lib/seed'

export interface AppSettingsView {
  defaultCurrency: string
  /** Empty means follow the machine's own locale. */
  numberLocale: string
}

const DEFAULTS: AppSettingsView = { defaultCurrency: 'USD', numberLocale: '' }

/** Current settings with defaults applied for any unset key. */
export async function getSettings(): Promise<AppSettingsView> {
  const stored = await getAppSettings()
  return {
    defaultCurrency: stored.defaultCurrency || DEFAULTS.defaultCurrency,
    numberLocale: stored.numberLocale ?? DEFAULTS.numberLocale,
  }
}

/** Convenience for forms that just need the default currency. */
export async function getDefaultCurrency(): Promise<string> {
  return (await getSettings()).defaultCurrency
}

export async function updateSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = {
    defaultCurrency: String(formData.get('defaultCurrency') ?? ''),
    numberLocale: String(formData.get('numberLocale') ?? ''),
  }
  const parsed = updateSettingsSchema.safeParse(values)
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors, values }

  const current = await getAppSettings()
  await saveAppSettings({
    ...current,
    defaultCurrency: parsed.data.defaultCurrency,
    numberLocale: parsed.data.numberLocale,
  })
  // Amount fields across the app read this, so refresh more than settings.
  revalidatePath('/app', 'layout')
  return { ok: true }
}

// ── AI settings ────────────────────────────────────────────────────────────────

/** Desktop runs the embedded DB; used to keep secrets out of the DB there. */
function isDesktopRuntime(): boolean {
  return process.env.DATABASE_DRIVER === 'embedded'
}

/**
 * Full AI config (incl. secrets) for running AI server-side. Never expose to the
 * client. The Anthropic key is resolved from the environment first — on desktop
 * it's injected there from the OS keychain vault (see apps/desktop/src/secrets.ts).
 * It falls back to the value stored in settings for a self-hosted setup.
 */
export async function getAiConfig(): Promise<AiConfig> {
  const settings = await getAppSettings()
  const ai: Partial<AiSettings> = settings.ai ?? {}
  return {
    mode: ai.mode ?? 'off',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY?.trim() || ai.anthropicApiKey,
    ollamaBaseUrl: ai.ollamaBaseUrl,
    fastModel: ai.fastModel,
    smartModel: ai.smartModel,
  }
}

/** Whether AI features should be offered in the UI. */
export async function isAiConfigured(): Promise<boolean> {
  const config = await getAiConfig()
  // The local-CLI provider spawns a subprocess — only usable in the desktop shell.
  if (config.mode === 'claude-cli' && !isDesktopRuntime()) return false
  return isAiEnabled(config)
}

export interface AiKeyStatus {
  /** A usable key is resolvable server-side (env/keychain or stored settings). */
  serverHasKey: boolean
  /** A plaintext key still sits in the DB (candidate for keychain migration). */
  legacyDbKey: boolean
  /** This process is the desktop shell (secrets belong in the keychain, not the DB). */
  desktop: boolean
}

/** Key-availability flags for the settings UI (never returns the key itself). */
export async function getAiKeyStatus(): Promise<AiKeyStatus> {
  const settings = await getAppSettings()
  const dbKey = settings.ai?.anthropicApiKey
  return {
    serverHasKey: Boolean(process.env.ANTHROPIC_API_KEY?.trim() || dbKey),
    legacyDbKey: Boolean(dbKey),
    desktop: isDesktopRuntime(),
  }
}

const AI_MODES = ['off', 'anthropic', 'ollama', 'claude-cli'] as const

export async function updateAiSettings(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const modeRaw = String(formData.get('mode') ?? 'off')
  const mode = (AI_MODES as readonly string[]).includes(modeRaw)
    ? (modeRaw as AiSettings['mode'])
    : 'off'
  const str = (k: string) => String(formData.get(k) ?? '').trim() || undefined

  const current = await getAppSettings()
  // On desktop the key lives in the OS keychain (written via the preload bridge),
  // never the DB — so drop it here, which also clears any legacy plaintext copy.
  // On web the key isn't sent to the browser, so a blank field means "keep the
  // stored one" rather than "clear it".
  const existingKey = current.ai?.anthropicApiKey
  const anthropicApiKey = isDesktopRuntime() ? undefined : (str('anthropicApiKey') ?? existingKey)
  const ai: AiSettings = {
    mode,
    anthropicApiKey,
    ollamaBaseUrl: str('ollamaBaseUrl'),
    fastModel: str('fastModel'),
    smartModel: str('smartModel'),
  }
  await saveAppSettings({ ...current, ai })
  revalidatePath('/app/settings')
  return { ok: true }
}

/** Round-trip a tiny prompt against the saved config to confirm it works. */
export async function testAiConnection(): Promise<{ ok: true; text: string } | { error: string }> {
  const config = await getAiConfig()
  if (!isAiEnabled(config)) return { error: 'AI is turned off or not fully configured.' }
  try {
    const text = await pingModel(config)
    return { ok: true, text: text.slice(0, 60) }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Connection failed' }
  }
}

// ── Danger zone ────────────────────────────────────────────────────────────────

export type DangerResult = { ok: true; deleted: number } | { error: string }

/** Delete every transaction (and import batch). Mappings, banks, accounts,
 * categories and tags are kept — only the imported transaction data is removed,
 * so you can re-import from scratch. */
export async function clearAllTransactions(): Promise<DangerResult> {
  const deleted = await db.transaction(async (tx) => {
    const removed = await tx.delete(transactions).returning({ id: transactions.id })
    await tx.delete(csvImports)
    return removed.length
  })
  for (const path of ['/app/transactions', '/app/subscriptions', '/app']) revalidatePath(path)
  return { ok: true, deleted }
}

/** Wipe ALL finance data — banks, branches, accounts, mappings, imports,
 * transactions, categories, tags and subscriptions. Settings are untouched. */
export async function resetAllData(): Promise<DangerResult> {
  const deleted = await db.transaction((tx) => wipeAllFinanceData(tx))
  for (const path of [
    '/app',
    '/app/banks',
    '/app/accounts',
    '/app/transactions',
    '/app/subscriptions',
    '/app/categories',
    '/app/tags',
  ])
    revalidatePath(path)
  return { ok: true, deleted }
}

// ── Backup & restore ─────────────────────────────────────────────────────────
// A full logical backup as portable JSON. The format, the tables it covers and
// the restore all live in @repo/database (see backup.ts there); these are the
// server actions the Settings page calls.

export type ExportResult = { ok: true; json: string; filename: string } | { error: string }

/** Serialize all data to a downloadable JSON backup. */
export async function exportData(): Promise<ExportResult> {
  try {
    const backup = await buildBackup(db)
    const stamp = new Date().toISOString().slice(0, 10)
    return {
      ok: true,
      json: JSON.stringify(backup, null, 2),
      filename: `pocket-cash-backup-${stamp}.json`,
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Export failed' }
  }
}

export type ImportResult = { ok: true; total: number } | { error: string }

/**
 * Restore a backup: REPLACES the data the file contains, in one transaction, so
 * a malformed file leaves the database untouched.
 */
export async function importData(json: string): Promise<ImportResult> {
  const parsed = parseBackup(json)
  if ('error' in parsed) return parsed

  let total: number
  try {
    total = await restoreBackup(db, parsed)
  } catch (error) {
    return {
      error:
        `Import failed. Nothing was changed. ${error instanceof Error ? error.message : ''}`.trim(),
    }
  }

  revalidatePath('/app', 'layout')
  return { ok: true, total }
}
