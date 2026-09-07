/**
 * The real startup path, end to end.
 *
 * `runEmbeddedMigrations` is what every launch calls: it opens PGlite, applies
 * the migrations and seeds the system property configuration. The seed being
 * wired in *there* rather than in each caller is the thing worth pinning down,
 * because a caller forgetting to seed would show up as an empty Add Cost list
 * rather than as an error.
 */

import { calculateBracketed, type RateSchedule } from '@repo/property'
import { eq } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'
import { runEmbeddedMigrations } from './embedded'
import { costTypes, jurisdictions, rateSchedules } from './schema'

const ready = runEmbeddedMigrations({ dataDir: 'memory://' })

afterAll(async () => {
  // The migration helper memoises on globalThis; nothing to close beyond letting
  // the in-memory instance go.
  await ready.catch(() => undefined)
})

describe('runEmbeddedMigrations', () => {
  it('brings up a database with the property tables and the seeded configuration', async () => {
    const db = await ready

    const jurisdiction = await db.query.jurisdictions.findFirst({
      where: eq(jurisdictions.key, 'AU-NSW'),
    })
    expect(jurisdiction?.transferTaxLabel).toBe('Transfer Duty')

    const costs = await db.select().from(costTypes)
    expect(costs.length).toBeGreaterThan(15)
  }, 60_000)

  it('leaves the seeded schedule ready for the engine', async () => {
    const db = await ready
    const row = await db.query.rateSchedules.findFirst({
      where: eq(rateSchedules.jurisdictionKey, 'AU-NSW'),
    })
    if (!row) throw new Error('no schedule seeded')

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
  }, 60_000)

  it('is safe to call again, as every launch does', async () => {
    await ready
    const db = await runEmbeddedMigrations({ dataDir: 'memory://' })
    const costs = await db.select().from(costTypes)
    const keys = costs.map((cost) => cost.key)
    expect(new Set(keys).size).toBe(keys.length)
  }, 60_000)
})
