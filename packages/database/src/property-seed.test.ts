/**
 * Integration test for the property schema and its seed, against a real
 * in-memory PGlite database.
 *
 * This is the only place the migrations are actually executed rather than just
 * generated, so it doubles as the check that the SQL applies cleanly on a fresh
 * database.
 */

import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'
import { fuzzystrmatch } from '@electric-sql/pglite/contrib/fuzzystrmatch'
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm'
import { calculateBracketed, type RateSchedule } from '@repo/property'
import { NSW_TRANSFER_DUTY_2026_27_ID } from '@repo/property/defaults'
import { eq, sql } from 'drizzle-orm'
import { drizzle, type PgliteDatabase } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { seedPropertyDefaults, TRANSFER_TAX_GROUP } from './property-seed'
import {
  banks,
  costCategories,
  costTypes,
  jurisdictions,
  properties,
  propertyCosts,
  rateSchedules,
  schema,
} from './schema'

type TestDb = PgliteDatabase<typeof schema>

let client: PGlite
let db: TestDb

beforeAll(async () => {
  client = new PGlite('memory://', { extensions: { pg_trgm, fuzzystrmatch } })
  await client.waitReady

  db = drizzle(client, { schema })
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`)
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS fuzzystrmatch`)

  const migrationsFolder = join(dirname(fileURLToPath(import.meta.url)), '../drizzle/migrations')
  await migrate(db, { migrationsFolder })

  // Cast: the seed takes the app's `Database`, which is the same drizzle
  // instance type built from the same schema.
  await seedPropertyDefaults(db as never)
}, 60_000)

afterAll(async () => {
  await client?.close()
})

describe('property migrations', () => {
  it('applies cleanly on a fresh database', async () => {
    const result = await db.execute(
      sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`,
    )
    const tables = result.rows.map((row) => (row as { table_name: string }).table_name)

    expect(tables).toEqual(
      expect.arrayContaining([
        'jurisdictions',
        'rate_schedules',
        'cost_categories',
        'cost_types',
        'properties',
        'property_loans',
        'property_costs',
        'property_recurring_costs',
        'property_rentals',
        'property_scenarios',
        'property_available_funds',
      ]),
    )
  })

  it('keeps the existing finance tables', async () => {
    const result = await db.execute(
      sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`,
    )
    const tables = result.rows.map((row) => (row as { table_name: string }).table_name)
    expect(tables).toEqual(expect.arrayContaining(['banks', 'accounts', 'transactions']))
  })
})

describe('seedPropertyDefaults', () => {
  it('seeds the Australia / NSW jurisdiction with its own tax label', async () => {
    const row = await db.query.jurisdictions.findFirst({ where: eq(jurisdictions.key, 'AU-NSW') })
    expect(row?.name).toBe('Australia / New South Wales')
    expect(row?.country).toBe('AU')
    expect(row?.currency).toBe('AUD')
    expect(row?.transferTaxLabel).toBe('Transfer Duty')
    expect(row?.isSystem).toBe(true)
  })

  it('seeds the NSW transfer duty schedule against that jurisdiction', async () => {
    const row = await db.query.rateSchedules.findFirst({
      where: eq(rateSchedules.key, NSW_TRANSFER_DUTY_2026_27_ID),
    })
    expect(row?.jurisdictionKey).toBe('AU-NSW')
    expect(row?.groupKey).toBe(TRANSFER_TAX_GROUP)
    expect(row?.effectiveFrom).toBe('2026-07-01')
    expect(row?.effectiveTo).toBe('2027-06-30')
    expect(row?.version).toBe(1)
    expect(row?.brackets).toHaveLength(6)
  })

  it('stores brackets the engine can use unchanged', async () => {
    // The point of the jsonb column: what comes back out feeds straight into the
    // engine and still produces the published figure.
    const row = await db.query.rateSchedules.findFirst({
      where: eq(rateSchedules.key, NSW_TRANSFER_DUTY_2026_27_ID),
    })
    if (!row) throw new Error('schedule not seeded')

    const schedule: RateSchedule = {
      id: row.id,
      name: row.name,
      jurisdiction: row.jurisdictionKey,
      country: 'AU',
      region: 'NSW',
      currency: row.currency,
      effectiveFrom: row.effectiveFrom,
      effectiveTo: row.effectiveTo,
      calculationType: 'bracketed',
      version: row.version,
      brackets: row.brackets,
    }

    const result = calculateBracketed(schedule, 1_000_000_00)
    expect(result.ok && result.value.total).toBe(39_187_00)
  })

  it('seeds the cost categories', async () => {
    const rows = await db.select().from(costCategories)
    expect(rows.length).toBeGreaterThanOrEqual(10)
    expect(rows.map((row) => row.key)).toEqual(expect.arrayContaining(['government', 'inspection']))
  })

  it('seeds both upfront and recurring cost types', async () => {
    const rows = await db.select().from(costTypes)
    const upfront = rows.filter((row) => row.scope === 'upfront')
    const recurring = rows.filter((row) => row.scope === 'recurring')
    expect(upfront.length).toBeGreaterThan(10)
    expect(recurring.length).toBeGreaterThan(5)
    expect(rows.every((row) => row.isSystem)).toBe(true)
  })

  it('points the transfer duty cost type at a schedule group, not a fixed schedule', async () => {
    // Resolving by group and date is what lets next year's schedule be added
    // without editing the cost type.
    const row = await db.query.costTypes.findFirst({ where: eq(costTypes.key, 'transfer-duty') })
    expect(row?.calculationType).toBe('bracketed')
    expect(row?.calculationBase).toBe('dutiableValue')
    expect(row?.rateScheduleGroup).toBe(TRANSFER_TAX_GROUP)
  })

  it('seeds a percentage cost with its base, ready for the engine', async () => {
    const row = await db.query.costTypes.findFirst({
      where: eq(costTypes.key, 'mortgage-insurance'),
    })
    expect(row?.calculationType).toBe('percentage')
    expect(row?.percentage).toBeCloseTo(0.012, 6)
    expect(row?.calculationBase).toBe('loanAmount')
  })

  it('is idempotent', async () => {
    const before = await db.select().from(costTypes)
    await seedPropertyDefaults(db as never)
    await seedPropertyDefaults(db as never)
    const after = await db.select().from(costTypes)
    expect(after.length).toBe(before.length)
  })

  it('does not overwrite a user edit to a seeded row', async () => {
    await db
      .update(costTypes)
      .set({ defaultValue: 750_00, name: 'Building Inspection (my guy)' })
      .where(eq(costTypes.key, 'building-inspection'))

    await seedPropertyDefaults(db as never)

    const row = await db.query.costTypes.findFirst({
      where: eq(costTypes.key, 'building-inspection'),
    })
    expect(row?.defaultValue).toBe(750_00)
    expect(row?.name).toBe('Building Inspection (my guy)')
  })
})

describe('referential rules', () => {
  it('refuses to delete a cost type a property is using, forcing a soft delete', async () => {
    const [property] = await db
      .insert(properties)
      .values({
        name: 'Test Property',
        country: 'AU',
        region: 'NSW',
        currency: 'AUD',
        jurisdictionKey: 'AU-NSW',
        purchasePrice: 1_000_000_00,
      })
      .returning()
    if (!property) throw new Error('property not inserted')

    const costType = await db.query.costTypes.findFirst({ where: eq(costTypes.key, 'surveyor') })
    if (!costType) throw new Error('cost type not seeded')

    await db.insert(propertyCosts).values({ propertyId: property.id, costTypeId: costType.id })

    await expect(db.delete(costTypes).where(eq(costTypes.id, costType.id))).rejects.toThrow()

    // The supported route: soft delete, which leaves the property cost working.
    await db.update(costTypes).set({ deletedAt: new Date() }).where(eq(costTypes.id, costType.id))

    const stillThere = await db.query.propertyCosts.findFirst({
      where: eq(propertyCosts.propertyId, property.id),
      with: { costType: true },
    })
    expect(stillThere?.costType.name).toBe('Surveyor')
  })

  it('removes a property and its children together', async () => {
    const [property] = await db
      .insert(properties)
      .values({ name: 'Doomed', country: 'AU', currency: 'AUD', jurisdictionKey: 'AU-NSW' })
      .returning()
    if (!property) throw new Error('property not inserted')

    const costType = await db.query.costTypes.findFirst({ where: eq(costTypes.key, 'valuation') })
    if (!costType) throw new Error('cost type not seeded')
    await db.insert(propertyCosts).values({ propertyId: property.id, costTypeId: costType.id })

    await db.delete(properties).where(eq(properties.id, property.id))

    const orphans = await db
      .select()
      .from(propertyCosts)
      .where(eq(propertyCosts.propertyId, property.id))
    expect(orphans).toHaveLength(0)
  })
})

describe('upgrading an existing database', () => {
  /**
   * The path a real user takes: a database created by the previous release,
   * holding their finance data, picking up the property migration on launch.
   * Applying 0000 on its own first is what makes this an upgrade rather than
   * another fresh install.
   */
  it('adds the property tables to a database that predates them, keeping its data', async () => {
    const migrationsFolder = join(dirname(fileURLToPath(import.meta.url)), '../drizzle/migrations')
    const journal = JSON.parse(
      readFileSync(join(migrationsFolder, 'meta/_journal.json'), 'utf-8'),
    ) as { entries: { idx: number; tag: string }[] }

    const first = journal.entries.find((entry) => entry.idx === 0)
    if (!first) throw new Error('no initial migration in the journal')

    // A migrations folder holding only the pre-property migration.
    const oldFolder = mkdtempSync(join(tmpdir(), 'pocket-cash-migrations-'))
    try {
      mkdirSync(join(oldFolder, 'meta'), { recursive: true })
      copyFileSync(join(migrationsFolder, `${first.tag}.sql`), join(oldFolder, `${first.tag}.sql`))
      writeFileSync(
        join(oldFolder, 'meta/_journal.json'),
        JSON.stringify({ ...journal, entries: [first] }),
      )

      const oldClient = new PGlite('memory://', { extensions: { pg_trgm, fuzzystrmatch } })
      await oldClient.waitReady
      const oldDb = drizzle(oldClient, { schema })
      await oldDb.execute(sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`)
      await oldDb.execute(sql`CREATE EXTENSION IF NOT EXISTS fuzzystrmatch`)

      try {
        await migrate(oldDb, { migrationsFolder: oldFolder })

        const [bank] = await oldDb.insert(banks).values({ name: 'Existing Bank' }).returning()
        expect(bank).toBeDefined()

        // The upgrade.
        await migrate(oldDb, { migrationsFolder })
        await seedPropertyDefaults(oldDb as never)

        const survivors = await oldDb.select().from(banks)
        expect(survivors).toHaveLength(1)
        expect(survivors[0]?.name).toBe('Existing Bank')

        const seeded = await oldDb.query.jurisdictions.findFirst({
          where: eq(jurisdictions.key, 'AU-NSW'),
        })
        expect(seeded?.transferTaxLabel).toBe('Transfer Duty')
      } finally {
        await oldClient.close()
      }
    } finally {
      rmSync(oldFolder, { recursive: true, force: true })
    }
  }, 60_000)
})

describe('dropping the account links', () => {
  /**
   * The path for anyone who already installed the release that shipped
   * `account_id` on property loans and available funds. Those columns are gone
   * now (the planner is deliberately standalone), and a DROP COLUMN on a table
   * that already holds rows is exactly where an upgrade can lose data, so this
   * migrates to the version that HAD them, writes a row, and then upgrades.
   */
  it('keeps existing property rows when the account columns are removed', async () => {
    const migrationsFolder = join(dirname(fileURLToPath(import.meta.url)), '../drizzle/migrations')
    const journal = JSON.parse(
      readFileSync(join(migrationsFolder, 'meta/_journal.json'), 'utf-8'),
    ) as { entries: { idx: number; tag: string }[] }

    // Everything up to and including the migration that introduced the columns.
    const upTo = journal.entries.filter((entry) => entry.idx <= 1)
    if (upTo.length < 2) throw new Error('expected at least two migrations in the journal')

    const oldFolder = mkdtempSync(join(tmpdir(), 'pocket-cash-migrations-'))
    const client = new PGlite('memory://', { extensions: { pg_trgm, fuzzystrmatch } })
    try {
      mkdirSync(join(oldFolder, 'meta'), { recursive: true })
      for (const entry of upTo) {
        copyFileSync(
          join(migrationsFolder, `${entry.tag}.sql`),
          join(oldFolder, `${entry.tag}.sql`),
        )
      }
      writeFileSync(
        join(oldFolder, 'meta/_journal.json'),
        JSON.stringify({ ...journal, entries: upTo }),
      )

      await client.waitReady
      const oldDb = drizzle(client, { schema })
      await oldDb.execute(sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`)
      await oldDb.execute(sql`CREATE EXTENSION IF NOT EXISTS fuzzystrmatch`)
      await migrate(oldDb, { migrationsFolder: oldFolder })

      // The columns exist at this point, so write through raw SQL: the compiled
      // schema no longer knows about them.
      await oldDb.execute(sql`
        INSERT INTO properties (id, name, country, currency, purchase_price)
        VALUES ('11111111-1111-1111-1111-111111111111', 'Legacy Property', 'AU', 'AUD', 100000000)
      `)
      await oldDb.execute(sql`
        INSERT INTO property_loans (property_id, loan_amount, account_id)
        VALUES ('11111111-1111-1111-1111-111111111111', 80000000, NULL)
      `)
      await oldDb.execute(sql`
        INSERT INTO property_available_funds (label, amount, account_id)
        VALUES ('Savings', 15000000, NULL)
      `)

      // The upgrade.
      await migrate(oldDb, { migrationsFolder })

      const loans = await oldDb.execute(sql`SELECT loan_amount FROM property_loans`)
      const funds = await oldDb.execute(sql`SELECT label, amount FROM property_available_funds`)
      expect(loans.rows).toHaveLength(1)
      expect(funds.rows).toHaveLength(1)
      expect((funds.rows[0] as { label: string }).label).toBe('Savings')

      // And the coupling is genuinely gone, not just unused.
      const columns = await oldDb.execute(sql`
        SELECT table_name FROM information_schema.columns
        WHERE column_name = 'account_id'
          AND table_name IN ('property_loans', 'property_available_funds')
      `)
      expect(columns.rows).toHaveLength(0)
    } finally {
      await client.close()
      rmSync(oldFolder, { recursive: true, force: true })
    }
  }, 60_000)
})
