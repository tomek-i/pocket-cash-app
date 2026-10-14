import { eq, getTableColumns } from 'drizzle-orm'
import type { PgTable } from 'drizzle-orm/pg-core'
import type { Database } from './client'
import {
  type AppSettings,
  accounts,
  appSettings,
  banks,
  branches,
  categories,
  costCategories,
  costTypes,
  csvImports,
  csvMappings,
  financialSubscriptions,
  jurisdictions,
  properties,
  propertyAvailableFunds,
  propertyCosts,
  propertyLoans,
  propertyRecurringCosts,
  propertyRentals,
  propertyScenarios,
  rateSchedules,
  tags,
  transactions,
  transactionTags,
} from './schema'

/**
 * A full logical backup of the user's data as portable JSON, and the restore
 * that reads it back. Row ids are kept, so every foreign key still lines up.
 *
 * Version 1 files hold only the finance tables and the default currency.
 * Version 2 adds property plans, the property cost settings (jurisdictions, rate
 * schedules, cost categories and types, which the user can edit) and the app
 * settings. A restore only replaces the groups of tables the file contains, so
 * restoring an old version 1 file leaves property data alone.
 */

export const BACKUP_FORMAT = 'pocket-cash-backup'
export const BACKUP_VERSION = 2
const READABLE_VERSIONS = [1, 2]

type Group = 'finance' | 'propertyConfig' | 'property'

/**
 * Every backed-up table, PARENT before CHILD within each group so inserts
 * satisfy foreign keys. Wiping walks the same list backwards. Groups are
 * restored in this order too: property plans point at the cost settings.
 */
const BACKUP_TABLES: { key: string; table: PgTable; group: Group }[] = [
  { key: 'banks', table: banks, group: 'finance' },
  { key: 'categories', table: categories, group: 'finance' },
  { key: 'tags', table: tags, group: 'finance' },
  { key: 'branches', table: branches, group: 'finance' },
  { key: 'csvMappings', table: csvMappings, group: 'finance' },
  { key: 'accounts', table: accounts, group: 'finance' },
  { key: 'financialSubscriptions', table: financialSubscriptions, group: 'finance' },
  { key: 'csvImports', table: csvImports, group: 'finance' },
  { key: 'transactions', table: transactions, group: 'finance' },
  { key: 'transactionTags', table: transactionTags, group: 'finance' },
  { key: 'jurisdictions', table: jurisdictions, group: 'propertyConfig' },
  { key: 'rateSchedules', table: rateSchedules, group: 'propertyConfig' },
  { key: 'costCategories', table: costCategories, group: 'propertyConfig' },
  { key: 'costTypes', table: costTypes, group: 'propertyConfig' },
  { key: 'properties', table: properties, group: 'property' },
  { key: 'propertyLoans', table: propertyLoans, group: 'property' },
  { key: 'propertyCosts', table: propertyCosts, group: 'property' },
  { key: 'propertyRecurringCosts', table: propertyRecurringCosts, group: 'property' },
  { key: 'propertyRentals', table: propertyRentals, group: 'property' },
  { key: 'propertyScenarios', table: propertyScenarios, group: 'property' },
  { key: 'propertyAvailableFunds', table: propertyAvailableFunds, group: 'property' },
]

/** Wiped children-first: property plans before the cost settings they use. */
const WIPE_ORDER: Group[] = ['property', 'propertyConfig', 'finance']

export interface BackupFile {
  format: typeof BACKUP_FORMAT
  formatVersion: number
  exportedAt: string
  /** App settings, without the AI key and the cached AI summaries. */
  settings: AppSettings
  tables: Record<string, Record<string, unknown>[]>
}

/**
 * Settings worth carrying to another machine. The API key never goes into a
 * plain file, and cached AI summaries are regenerated rather than restored.
 */
function portableSettings(settings: AppSettings): AppSettings {
  const { aiInsights: _cached, ai, ...rest } = settings
  if (!ai) return rest
  const { anthropicApiKey: _key, ...portableAi } = ai
  return { ...rest, ai: portableAi }
}

/** Every backed-up table, plus the portable settings. */
export async function buildBackup(db: Database): Promise<BackupFile> {
  const tables: Record<string, Record<string, unknown>[]> = {}
  for (const { key, table } of BACKUP_TABLES) {
    tables[key] = (await db.select().from(table)) as Record<string, unknown>[]
  }
  const [row] = await db.select().from(appSettings).where(eq(appSettings.id, 'app'))
  return {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    settings: portableSettings(row?.settings ?? {}),
    tables,
  }
}

/** Read and check a backup file, or say why it cannot be used. */
export function parseBackup(json: string): BackupFile | { error: string } {
  let parsed: BackupFile
  try {
    parsed = JSON.parse(json)
  } catch {
    return { error: 'Could not read the file. It is not valid JSON.' }
  }
  if (!parsed || typeof parsed !== 'object' || parsed.format !== BACKUP_FORMAT) {
    return { error: 'This is not a Pocket Cash backup file.' }
  }
  if (!READABLE_VERSIONS.includes(parsed.formatVersion)) {
    return {
      error: `This backup is version ${parsed.formatVersion}; this app reads versions up to ${BACKUP_VERSION}.`,
    }
  }
  const source = parsed.tables ?? {}
  for (const { key } of BACKUP_TABLES) {
    if (source[key] != null && !Array.isArray(source[key])) {
      return { error: `The backup is malformed: "${key}" is not a list.` }
    }
  }
  return { ...parsed, tables: source, settings: parsed.settings ?? {} }
}

/**
 * Replace the user's data with a backup, in one transaction: if anything fails,
 * nothing changes. Returns the number of rows restored.
 *
 * Only the groups the file contains are replaced. The finance group is always
 * replaced, as version 1 restores always did.
 */
export async function restoreBackup(db: Database, backup: BackupFile): Promise<number> {
  const source = backup.tables
  const included = new Set<Group>(['finance'])
  for (const { key, group } of BACKUP_TABLES) if (key in source) included.add(group)

  await db.transaction(async (tx) => {
    for (const group of WIPE_ORDER) {
      if (!included.has(group)) continue
      const inGroup = BACKUP_TABLES.filter((t) => t.group === group).reverse()
      for (const { table } of inGroup) await tx.delete(table)
    }

    // A transfer points at its other side, which may come in a later batch, so
    // the links are written after every transaction is in.
    const transferPairs: { id: string; pairId: string }[] = []
    // A single multi-row INSERT of thousands of rows overflows PGlite's bind
    // limits, so insert in batches.
    const INSERT_BATCH = 500
    for (const { key, table, group } of BACKUP_TABLES) {
      if (!included.has(group)) continue
      const rows = source[key] ?? []
      if (!rows.length) continue
      const columns = getTableColumns(table)
      const revived = rows.map((row) => {
        const out: Record<string, unknown> = { ...row }
        // JSON has no Date type: timestamp columns come back as ISO strings.
        for (const [name, col] of Object.entries(columns)) {
          if (out[name] != null && col.dataType === 'date')
            out[name] = new Date(out[name] as string)
        }
        if (key === 'transactions' && typeof out.transferPairId === 'string') {
          transferPairs.push({ id: String(out.id), pairId: out.transferPairId })
          out.transferPairId = null
        }
        return out
      })
      for (let i = 0; i < revived.length; i += INSERT_BATCH) {
        await tx.insert(table).values(revived.slice(i, i + INSERT_BATCH))
      }
    }
    for (const { id, pairId } of transferPairs) {
      await tx.update(transactions).set({ transferPairId: pairId }).where(eq(transactions.id, id))
    }

    // Settings: take the backup's, but keep this machine's AI key, cached
    // summaries and onboarding state.
    const [row] = await tx.select().from(appSettings).where(eq(appSettings.id, 'app'))
    const current = row?.settings ?? {}
    const incoming = portableSettings(backup.settings)
    const next: AppSettings = {
      ...current,
      ...incoming,
      ai: incoming.ai
        ? { ...incoming.ai, anthropicApiKey: current.ai?.anthropicApiKey }
        : current.ai,
      aiInsights: current.aiInsights,
      onboardingCompleted: current.onboardingCompleted,
    }
    await tx
      .insert(appSettings)
      .values({ id: 'app', settings: next, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: appSettings.id,
        set: { settings: next, updatedAt: new Date() },
      })
  })

  return BACKUP_TABLES.reduce(
    (sum, { key, group }) => sum + (included.has(group) ? (source[key]?.length ?? 0) : 0),
    0,
  )
}
