'use server'

import { type AiConfig, isAiEnabled, pingModel } from '@repo/ai'
import {
  type AiSettings,
  accounts,
  banks,
  branches,
  categories,
  csvImports,
  csvMappings,
  db,
  financialSubscriptions,
  getAppSettings,
  getTableColumns,
  saveAppSettings,
  tags,
  transactions,
  transactionTags,
} from '@repo/database'
import { updateSettingsSchema } from '@repo/validation'
import { revalidatePath } from 'next/cache'
import type { ActionState } from '@/lib/action-state'
import { wipeAllFinanceData } from '../_lib/seed'

export interface AppSettingsView {
  defaultCurrency: string
}

const DEFAULTS: AppSettingsView = { defaultCurrency: 'USD' }

/** Current settings with defaults applied for any unset key. */
export async function getSettings(): Promise<AppSettingsView> {
  const stored = await getAppSettings()
  return { defaultCurrency: stored.defaultCurrency || DEFAULTS.defaultCurrency }
}

/** Convenience for forms that just need the default currency. */
export async function getDefaultCurrency(): Promise<string> {
  return (await getSettings()).defaultCurrency
}

export async function updateSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = { defaultCurrency: String(formData.get('defaultCurrency') ?? '') }
  const parsed = updateSettingsSchema.safeParse(values)
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors, values }

  const current = await getAppSettings()
  await saveAppSettings({ ...current, defaultCurrency: parsed.data.defaultCurrency })
  revalidatePath('/app/settings')
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
// A full logical backup of the finance data as portable JSON. Version-tagged.
// Export gathers every table; import wipes the data and restores the file (a true
// "restore from backup"). Row ids are preserved so foreign keys stay intact.

const BACKUP_FORMAT = 'pocket-cash-backup'
const BACKUP_VERSION = 1

// Ordered PARENT→CHILD so inserts satisfy foreign keys (the reverse of the
// delete order in resetAllData).
const BACKUP_TABLES = [
  { key: 'banks', table: banks },
  { key: 'categories', table: categories },
  { key: 'tags', table: tags },
  { key: 'branches', table: branches },
  { key: 'csvMappings', table: csvMappings },
  { key: 'accounts', table: accounts },
  { key: 'financialSubscriptions', table: financialSubscriptions },
  { key: 'csvImports', table: csvImports },
  { key: 'transactions', table: transactions },
  { key: 'transactionTags', table: transactionTags },
] as const

export interface BackupFile {
  format: typeof BACKUP_FORMAT
  formatVersion: number
  exportedAt: string
  settings: { defaultCurrency: string }
  tables: Record<string, Record<string, unknown>[]>
}

export type ExportResult = { ok: true; json: string; filename: string } | { error: string }

/** Serialize all finance data to a downloadable JSON backup. */
export async function exportData(): Promise<ExportResult> {
  try {
    const tables: Record<string, Record<string, unknown>[]> = {}
    for (const { key, table } of BACKUP_TABLES) {
      tables[key] = (await db.select().from(table)) as Record<string, unknown>[]
    }

    const settings = await getSettings()
    const backup: BackupFile = {
      format: BACKUP_FORMAT,
      formatVersion: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      settings: { defaultCurrency: settings.defaultCurrency },
      tables,
    }
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
 * Restore a backup: REPLACES all finance data with the file's contents. Runs in
 * one transaction so a malformed file leaves the DB untouched. JSON has no Date
 * type, so timestamp columns are revived from their ISO strings (detected
 * generically via the Drizzle column metadata).
 */
export async function importData(json: string): Promise<ImportResult> {
  let parsed: BackupFile
  try {
    parsed = JSON.parse(json)
  } catch {
    return { error: 'Could not read the file — it is not valid JSON.' }
  }
  if (!parsed || typeof parsed !== 'object' || parsed.format !== BACKUP_FORMAT) {
    return { error: 'This is not a Pocket Cash backup file.' }
  }
  if (parsed.formatVersion !== BACKUP_VERSION) {
    return {
      error: `This backup is version ${parsed.formatVersion}; this app reads version ${BACKUP_VERSION}.`,
    }
  }
  const source = parsed.tables ?? {}
  for (const { key } of BACKUP_TABLES) {
    if (source[key] != null && !Array.isArray(source[key])) {
      return { error: `The backup is malformed: "${key}" is not a list.` }
    }
  }

  try {
    await db.transaction(async (tx) => {
      // 1. Wipe existing finance data (children first; transaction_tags cascade
      //    off transactions).
      await wipeAllFinanceData(tx)

      // 2. Insert the backup's rows parent→child, reviving dates. Insert in
      //    batches: a single multi-row INSERT of thousands of rows overflows the
      //    driver's bind limits (PGlite throws "Invalid array length"), so chunk.
      const INSERT_BATCH = 500
      for (const { key, table } of BACKUP_TABLES) {
        const rows = (source[key] ?? []) as Record<string, unknown>[]
        if (!rows.length) continue
        const columns = getTableColumns(table)
        const revived = rows.map((row) => {
          const out: Record<string, unknown> = { ...row }
          for (const [name, col] of Object.entries(columns)) {
            if (out[name] != null && col.dataType === 'date')
              out[name] = new Date(out[name] as string)
          }
          return out
        })
        for (let i = 0; i < revived.length; i += INSERT_BATCH) {
          await tx.insert(table).values(revived.slice(i, i + INSERT_BATCH))
        }
      }
    })

    // 3. Restore the default currency (keep other settings, e.g. AI).
    if (parsed.settings?.defaultCurrency) {
      const current = await getAppSettings()
      await saveAppSettings({ ...current, defaultCurrency: parsed.settings.defaultCurrency })
    }
  } catch (error) {
    return {
      error:
        `Import failed — nothing was changed. ${error instanceof Error ? error.message : ''}`.trim(),
    }
  }

  const total = BACKUP_TABLES.reduce((sum, { key }) => sum + (source[key]?.length ?? 0), 0)
  for (const path of [
    '/app',
    '/app/banks',
    '/app/accounts',
    '/app/transactions',
    '/app/subscriptions',
    '/app/categories',
    '/app/tags',
    '/app/settings',
  ])
    revalidatePath(path)
  return { ok: true, total }
}
