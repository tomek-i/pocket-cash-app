'use server'

import { type CsvMappingConfig, csvMappingConfigSchema, fingerprint, parseCsv } from '@repo/csv'
import {
  type Account,
  accounts,
  asc,
  banks,
  csvImports,
  csvMappings,
  db,
  eq,
  transactions,
} from '@repo/database'
import { createLogger } from '@repo/logger'
import { revalidatePath } from 'next/cache'

const log = createLogger('csv-import')

export interface SavedMapping {
  id: string
  name: string
  isDefault: boolean
  config: CsvMappingConfig
}

async function getAccount(accountId: string): Promise<Account | undefined> {
  return db.query.accounts.findFirst({ where: eq(accounts.id, accountId) })
}

export async function listMappings(bankId: string): Promise<SavedMapping[]> {
  const rows = await db
    .select({
      id: csvMappings.id,
      name: csvMappings.name,
      isDefault: csvMappings.isDefault,
      config: csvMappings.config,
    })
    .from(csvMappings)
    .where(eq(csvMappings.bankId, bankId))
    .orderBy(asc(csvMappings.name))
  // `config` is validated jsonb; coerce to the typed shape for callers.
  return rows.map((r) => ({ ...r, config: r.config as CsvMappingConfig }))
}

export type SaveMappingResult = { ok: true; id: string } | { error: string }

export async function saveMapping(input: {
  bankId: string
  mappingId?: string
  name: string
  isDefault: boolean
  config: unknown
}): Promise<SaveMappingResult> {
  const bank = await db.query.banks.findFirst({
    where: eq(banks.id, input.bankId),
    columns: { id: true },
  })
  if (!bank) return { error: 'Unknown bank' }

  const name = input.name.trim()
  if (!name) return { error: 'Give the mapping a name' }

  const parsed = csvMappingConfigSchema.safeParse(input.config)
  if (!parsed.success) return { error: 'Invalid mapping configuration' }
  const config = parsed.data

  try {
    const id = await db.transaction(async (tx) => {
      // The partial unique index allows only one default per bank, so clear the
      // others first when this one becomes the default.
      if (input.isDefault) {
        await tx
          .update(csvMappings)
          .set({ isDefault: false })
          .where(eq(csvMappings.bankId, input.bankId))
      }
      if (input.mappingId) {
        await tx
          .update(csvMappings)
          .set({ name, config, isDefault: input.isDefault, updatedAt: new Date() })
          .where(eq(csvMappings.id, input.mappingId))
        return input.mappingId
      }
      const [row] = await tx
        .insert(csvMappings)
        .values({
          bankId: input.bankId,
          name,
          config,
          isDefault: input.isDefault,
        })
        .returning({ id: csvMappings.id })
      return row?.id ?? ''
    })
    // 'layout' so the nested import page (which loads these mappings) is
    // refreshed too, not just the bank page.
    revalidatePath(`/app/banks/${input.bankId}`, 'layout')
    return { ok: true, id }
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === '23505'
    ) {
      return { error: 'A mapping with this name already exists for this bank' }
    }
    throw error
  }
}

export interface ImportResult {
  imported: number
  skipped: number
  errors: number
  total: number
}

export async function runImport(input: {
  bankId: string
  accountId: string
  fileName: string
  config: unknown
  fileText: string
}): Promise<{ result?: ImportResult; error?: string }> {
  const account = await getAccount(input.accountId)
  if (!account) return { error: 'Account not found' }

  const parsed = csvMappingConfigSchema.safeParse(input.config)
  if (!parsed.success) return { error: 'Invalid mapping configuration' }
  const config = parsed.data

  const parseResult = parseCsv(input.fileText, config)
  const okRows = parseResult.rows.flatMap((row) => (row.transaction ? [row.transaction] : []))

  const [batch] = await db
    .insert(csvImports)
    .values({
      accountId: account.id,
      fileName: input.fileName,
      rowCount: parseResult.rows.length,
      status: 'pending',
    })
    .returning({ id: csvImports.id })
  if (!batch) return { error: 'Could not start import' }

  // Build rows, de-duplicating within this file by fingerprint.
  const seen = new Set<string>()
  const values: (typeof transactions.$inferInsert)[] = []
  for (const txn of okRows) {
    const fp = fingerprint(txn, {
      accountId: account.id,
      strategy: config.dedupe.strategy,
      fields: config.dedupe.fields,
    })
    if (seen.has(fp)) continue
    seen.add(fp)
    values.push({
      accountId: account.id,
      importId: batch.id,
      date: txn.date,
      valueDate: txn.valueDate ?? null,
      description: txn.description,
      merchant: txn.merchant ?? null,
      amount: txn.amount,
      currency: txn.currency ?? account.currency,
      balance: txn.balance ?? null,
      reference: txn.reference ?? null,
      rawData: txn.rawData,
      fingerprint: fp,
    })
  }

  let imported = 0
  try {
    // A single bulk insert of a large file overflows the bind-parameter limit
    // (PGlite breaks at the signed-Int16 boundary, ~32767 params, throwing
    // "Invalid array length" — and wedging the connection). Chunk the rows to keep
    // each statement's parameter count well under that, plus a hard row cap.
    const colCount = values[0] ? Object.keys(values[0]).length : 1
    const chunkSize = Math.max(1, Math.min(1000, Math.floor(20000 / colCount)))
    for (let i = 0; i < values.length; i += chunkSize) {
      const inserted = await db
        .insert(transactions)
        .values(values.slice(i, i + chunkSize))
        .onConflictDoNothing({ target: [transactions.accountId, transactions.fingerprint] })
        .returning({ id: transactions.id })
      imported += inserted.length
    }
  } catch (error) {
    await db
      .update(csvImports)
      .set({ status: 'failed' })
      .where(eq(csvImports.id, batch.id))
      .catch(() => {})
    log.error('CSV import failed while inserting transactions', { err: error, batchId: batch.id })
    return { error: 'Import failed while saving transactions. Please try again.' }
  }

  const result: ImportResult = {
    imported,
    skipped: okRows.length - imported,
    errors: parseResult.errorCount,
    total: parseResult.rows.length,
  }
  await db
    .update(csvImports)
    .set({
      importedCount: result.imported,
      skippedCount: result.skipped,
      errorCount: result.errors,
      status: 'completed',
    })
    .where(eq(csvImports.id, batch.id))

  revalidatePath(`/app/banks/${input.bankId}/accounts/${input.accountId}/import`)
  return { result }
}
