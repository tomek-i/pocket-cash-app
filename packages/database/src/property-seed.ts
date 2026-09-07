import {
  DEFAULT_COST_CATEGORIES,
  DEFAULT_JURISDICTIONS,
  DEFAULT_RATE_SCHEDULES,
  DEFAULT_RECURRING_COST_TYPES,
  DEFAULT_UPFRONT_COST_TYPES,
} from '@repo/property/defaults'
import type { Database } from './client'
import { costCategories, costTypes, jurisdictions, rateSchedules } from './schema'

/**
 * The rate schedule group for a jurisdiction's purchase tax, whatever it is
 * locally called. Costs resolve a schedule by jurisdiction, group and date.
 */
export const TRANSFER_TAX_GROUP = 'transfer-tax'

/**
 * Write the seeded property configuration: the Australia / NSW jurisdiction, the
 * NSW 2026/27 transfer duty schedule, the cost categories and the cost
 * catalogue.
 *
 * **Insert only, never update.** Every statement is `onConflictDoNothing` keyed
 * on the stable `key` column, so running this on every launch is a no-op once
 * the rows exist and a user's edit to a seeded row is never clobbered.
 *
 * The trade-off is that changing a seeded default in a later release does not
 * reach installs that already have the row. That is the right way round for now
 * (losing someone's edited cost is worse than shipping a stale default), and the
 * settings work in #72 adds an explicit system-default versus user-override
 * split that can do better.
 */
export async function seedPropertyDefaults(db: Database): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .insert(jurisdictions)
      .values(
        DEFAULT_JURISDICTIONS.map((jurisdiction) => ({
          key: jurisdiction.id,
          name: jurisdiction.name,
          country: jurisdiction.country,
          region: jurisdiction.region,
          currency: jurisdiction.currency,
          transferTaxLabel: jurisdiction.transferTaxLabel,
          isSystem: true,
        })),
      )
      .onConflictDoNothing({ target: jurisdictions.key })

    await tx
      .insert(rateSchedules)
      .values(
        DEFAULT_RATE_SCHEDULES.map((schedule) => ({
          key: schedule.id,
          name: schedule.name,
          jurisdictionKey: schedule.jurisdiction,
          // Every seeded schedule is a transfer tax today. When another kind of
          // charge is seeded this moves onto the default itself.
          groupKey: TRANSFER_TAX_GROUP,
          currency: schedule.currency,
          effectiveFrom: schedule.effectiveFrom,
          effectiveTo: schedule.effectiveTo,
          version: schedule.version,
          brackets: schedule.brackets,
          isSystem: true,
          enabled: schedule.enabled ?? true,
        })),
      )
      .onConflictDoNothing({ target: rateSchedules.key })

    await tx
      .insert(costCategories)
      .values(
        DEFAULT_COST_CATEGORIES.map((category) => ({
          key: category.id,
          name: category.name,
          sortOrder: category.order,
          isSystem: true,
        })),
      )
      .onConflictDoNothing({ target: costCategories.key })

    const upfront = DEFAULT_UPFRONT_COST_TYPES.map((type) => ({
      key: type.id,
      name: type.name,
      category: type.category,
      scope: 'upfront' as const,
      calculationType: type.calculationType,
      defaultValue: type.defaultValue ?? null,
      percentage: type.percentage ?? null,
      calculationBase: type.calculationBase ?? null,
      formula: type.formula ?? null,
      // The seeded default points at a specific schedule id; the database models
      // it as a *group* so next year's schedule is picked up by date instead of
      // needing the cost type edited.
      rateScheduleGroup: type.rateScheduleId ? TRANSFER_TAX_GROUP : null,
      defaultFrequency: null,
      notes: type.notes ?? null,
      isSystem: true,
      enabled: type.enabled,
    }))

    const recurring = DEFAULT_RECURRING_COST_TYPES.map((type) => ({
      key: type.id,
      name: type.name,
      category: type.category,
      scope: 'recurring' as const,
      calculationType: type.calculationType,
      defaultValue: type.defaultValue ?? null,
      percentage: type.percentage ?? null,
      calculationBase: type.calculationBase ?? null,
      formula: type.formula ?? null,
      rateScheduleGroup: null,
      defaultFrequency: type.defaultFrequency,
      notes: type.notes ?? null,
      isSystem: true,
      enabled: type.enabled,
    }))

    await tx
      .insert(costTypes)
      .values([...upfront, ...recurring])
      .onConflictDoNothing({ target: costTypes.key })
  })
}
