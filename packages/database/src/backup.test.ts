/**
 * A JSON backup taken, the data then changed, and the backup restored, against
 * a real (in-memory) database with the real migrations.
 */

import { asc, eq } from 'drizzle-orm'
import { beforeAll, describe, expect, it } from 'vitest'
import { type BackupFile, buildBackup, parseBackup, restoreBackup } from './backup'
import type { Database } from './client'
import { runEmbeddedMigrations } from './embedded'
import {
  accounts,
  appSettings,
  banks,
  budgetBucketCategories,
  budgetBuckets,
  budgetIncomes,
  categories,
  costTypes,
  financialSubscriptions,
  properties,
  propertyLoans,
  transactions,
  transferDismissals,
} from './schema'

let db: Database
let backup: BackupFile
let outId: string
let inId: string
let propertyId: string

function txn(accountId: string, amount: number, fingerprint: string) {
  return {
    accountId,
    date: '2026-09-26',
    description: amount < 0 ? 'Transfer to savings' : 'Transfer from checking',
    amount,
    currency: 'AUD',
    rawData: {},
    fingerprint,
    isTransfer: true,
  }
}

beforeAll(async () => {
  db = await runEmbeddedMigrations({ dataDir: 'memory://' })

  const [bank] = await db.insert(banks).values({ name: 'Test Bank' }).returning()
  if (!bank) throw new Error('no bank')
  const [checking, savings] = await db
    .insert(accounts)
    .values([
      { bankId: bank.id, name: 'Checking', currency: 'AUD' },
      { bankId: bank.id, name: 'Savings', currency: 'AUD' },
    ])
    .returning()
  if (!checking || !savings) throw new Error('no accounts')
  const [out, inn] = await db
    .insert(transactions)
    .values([txn(checking.id, -40_000, 'a'), txn(savings.id, 40_000, 'b')])
    .returning()
  if (!out || !inn) throw new Error('no transactions')
  outId = out.id
  inId = inn.id
  await db.update(transactions).set({ transferPairId: inId }).where(eq(transactions.id, outId))
  await db.update(transactions).set({ transferPairId: outId }).where(eq(transactions.id, inId))
  await db.insert(transferDismissals).values({ outId, inId })

  const [property] = await db
    .insert(properties)
    .values({ name: 'Unit 4', country: 'AU', currency: 'AUD', purchasePrice: 650_000_00 })
    .returning()
  if (!property) throw new Error('no property')
  propertyId = property.id
  await db.insert(propertyLoans).values({ propertyId, loanAmount: 520_000_00, annualRate: 0.06 })
  await db.insert(costTypes).values({ name: 'Solar inspection', defaultValue: 250_00 })

  const [rent] = await db.insert(categories).values({ name: 'Rent' }).returning()
  if (!rent) throw new Error('no category')
  await db.insert(budgetIncomes).values({ name: 'Salary', amount: 6_500_00 })
  await db.insert(budgetBuckets).values({ type: 'essentials', shareBps: 10_000, active: true })
  await db.insert(budgetBucketCategories).values({ categoryId: rent.id, bucketType: 'essentials' })

  await db.insert(appSettings).values({
    id: 'app',
    settings: {
      defaultCurrency: 'AUD',
      onboardingCompleted: true,
      ai: { mode: 'anthropic', anthropicApiKey: 'sk-secret' },
    },
  })

  // Through JSON, exactly as the file on disk would be.
  const parsed = parseBackup(JSON.stringify(await buildBackup(db)))
  if ('error' in parsed) throw new Error(parsed.error)
  backup = parsed
}, 60_000)

describe('buildBackup', () => {
  it('includes property plans and the user-editable cost settings', () => {
    expect(backup.tables.properties).toHaveLength(1)
    expect(backup.tables.propertyLoans).toHaveLength(1)
    expect(backup.tables.costTypes?.some((c) => c.name === 'Solar inspection')).toBe(true)
    expect(backup.tables.jurisdictions?.length).toBeGreaterThan(0)
  })

  it('keeps the API key out of the file', () => {
    expect(backup.settings.ai?.mode).toBe('anthropic')
    expect(backup.settings.ai?.anthropicApiKey).toBeUndefined()
    expect(JSON.stringify(backup)).not.toContain('sk-secret')
  })
})

describe('restoreBackup', () => {
  it('brings back everything, including linked transfers', async () => {
    await db.delete(properties)
    await db.delete(transactions)
    await db.delete(costTypes).where(eq(costTypes.name, 'Solar inspection'))

    await restoreBackup(db, backup)

    const out = await db.query.transactions.findFirst({ where: eq(transactions.id, outId) })
    expect(out?.transferPairId).toBe(inId)
    expect(await db.select().from(transferDismissals)).toEqual([
      expect.objectContaining({ outId, inId }),
    ])
    const loan = await db.query.propertyLoans.findFirst({
      where: eq(propertyLoans.propertyId, propertyId),
    })
    expect(loan?.loanAmount).toBe(520_000_00)
    const solar = await db.query.costTypes.findFirst({
      where: eq(costTypes.name, 'Solar inspection'),
    })
    expect(solar?.defaultValue).toBe(250_00)
  }, 60_000)

  it('brings back the budget plan with its category links', async () => {
    await db.delete(budgetIncomes)
    await db.delete(budgetBuckets)

    await restoreBackup(db, backup)

    expect(await db.select().from(budgetIncomes)).toEqual([
      expect.objectContaining({ name: 'Salary', amount: 6_500_00 }),
    ])
    expect(await db.select().from(budgetBuckets)).toEqual([
      expect.objectContaining({ type: 'essentials', shareBps: 10_000, active: true }),
    ])
    expect(await db.select().from(budgetBucketCategories)).toHaveLength(1)
  }, 60_000)

  it("keeps this machine's API key", async () => {
    const [row] = await db.select().from(appSettings).where(eq(appSettings.id, 'app'))
    expect(row?.settings.ai?.anthropicApiKey).toBe('sk-secret')
    expect(row?.settings.defaultCurrency).toBe('AUD')
  })

  it('leaves property data alone when restoring a version 1 file', async () => {
    const v1: BackupFile = {
      ...backup,
      formatVersion: 1,
      settings: { defaultCurrency: 'NZD' },
      tables: Object.fromEntries(
        Object.entries(backup.tables).filter(
          ([key]) =>
            !key.startsWith('property') &&
            !key.startsWith('budget') &&
            ![
              'properties',
              'jurisdictions',
              'rateSchedules',
              'costCategories',
              'costTypes',
            ].includes(key),
        ),
      ),
    }
    await restoreBackup(db, v1)

    expect(await db.select().from(properties)).toHaveLength(1)
    expect(await db.select().from(budgetIncomes)).toHaveLength(1)
    const [row] = await db.select().from(appSettings).where(eq(appSettings.id, 'app'))
    expect(row?.settings.defaultCurrency).toBe('NZD')
  }, 60_000)

  it('turns the old subscription active flag into a status', async () => {
    const sub = (name: string, active: boolean) => ({
      id: crypto.randomUUID(),
      name,
      amount: 999,
      currency: 'AUD',
      cycle: 'monthly',
      active,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-03-15T09:30:00.000Z',
    })
    await restoreBackup(db, {
      ...backup,
      tables: {
        ...backup.tables,
        financialSubscriptions: [sub('Netflix', true), sub('Gym', false)],
      },
    })

    const rows = await db
      .select()
      .from(financialSubscriptions)
      .orderBy(asc(financialSubscriptions.name))
    expect(rows.map((r) => [r.name, r.status, r.endDate])).toEqual([
      ['Gym', 'cancelled', '2026-03-15'],
      ['Netflix', 'active', null],
    ])
  }, 60_000)
})

describe('parseBackup', () => {
  it('refuses files that are not backups or are too new', () => {
    expect(parseBackup('not json')).toHaveProperty('error')
    expect(parseBackup('{"format":"other"}')).toHaveProperty('error')
    expect(
      parseBackup(JSON.stringify({ format: 'pocket-cash-backup', formatVersion: 99, tables: {} })),
    ).toHaveProperty('error')
  })
})
