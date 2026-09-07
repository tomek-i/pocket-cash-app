'use server'

import type { RateScheduleSnapshot } from '@repo/database'
import {
  and,
  asc,
  type CostType,
  costTypes,
  db,
  eq,
  isNull,
  max,
  type PropertyCost,
  properties,
  propertyCosts,
} from '@repo/database'
import {
  addPropertyCostSchema,
  completePurchaseSchema,
  propertyCostIdSchema,
  propertyCostValueSchema,
  togglePropertyCostSchema,
} from '@repo/validation'
import { revalidatePath } from 'next/cache'
import type { ActionState } from '@/lib/action-state'

/**
 * Cost rows on a property.
 *
 * Every action here writes to `property_costs` and never to `cost_types`: a
 * per-property override must not edit the definition other properties share.
 */

export type PropertyCostWithType = PropertyCost & { costType: CostType }

function revalidate(propertyId: string): void {
  revalidatePath(`/app/property/${propertyId}/planner`)
  revalidatePath('/app/property')
}

/** The cost rows on a property, with the type each one references. */
export async function listPropertyCosts(propertyId: string): Promise<PropertyCostWithType[]> {
  return db.query.propertyCosts.findMany({
    where: eq(propertyCosts.propertyId, propertyId),
    with: { costType: true },
    orderBy: asc(propertyCosts.sortOrder),
  })
}

/**
 * Cost types available to add: enabled, not soft-deleted, upfront scope.
 *
 * Read from the database rather than a list in code, which is the point of the
 * whole cost type system: a user adding "Solar Inspection" in settings gets it
 * here without anyone shipping a release.
 */
export async function listAvailableCostTypes(): Promise<CostType[]> {
  return db
    .select()
    .from(costTypes)
    .where(
      and(eq(costTypes.scope, 'upfront'), eq(costTypes.enabled, true), isNull(costTypes.deletedAt)),
    )
    .orderBy(asc(costTypes.category), asc(costTypes.name))
}

/** Add a cost to a property, seeded from the type's defaults. */
export async function addPropertyCost(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = addPropertyCostSchema.safeParse({
    propertyId: formData.get('propertyId'),
    costTypeId: formData.get('costTypeId'),
  })
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors }

  const { propertyId, costTypeId } = parsed.data

  const existing = await db.query.propertyCosts.findFirst({
    where: and(eq(propertyCosts.propertyId, propertyId), eq(propertyCosts.costTypeId, costTypeId)),
  })
  if (existing) {
    // Already on the property. Re-enable rather than refusing, since that is
    // what someone adding it again is asking for.
    await db
      .update(propertyCosts)
      .set({ enabled: true, updatedAt: new Date() })
      .where(eq(propertyCosts.id, existing.id))
    revalidate(propertyId)
    return { ok: true }
  }

  const [{ value: highest } = { value: null }] = await db
    .select({ value: max(propertyCosts.sortOrder) })
    .from(propertyCosts)
    .where(eq(propertyCosts.propertyId, propertyId))

  await db.insert(propertyCosts).values({ propertyId, costTypeId, sortOrder: (highest ?? 0) + 1 })

  revalidate(propertyId)
  return { ok: true }
}

/** Remove a cost row from a property entirely. */
export async function removePropertyCost(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = propertyCostIdSchema.safeParse({ id: formData.get('id') })
  if (!parsed.success) return { errors: { id: ['Missing id'] } }

  const [removed] = await db
    .delete(propertyCosts)
    .where(eq(propertyCosts.id, parsed.data.id))
    .returning({ propertyId: propertyCosts.propertyId })

  if (removed) revalidate(removed.propertyId)
  return { ok: true }
}

/** Turn a cost on or off without losing its override or actual amount. */
export async function togglePropertyCost(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = togglePropertyCostSchema.safeParse({
    id: formData.get('id'),
    enabled: formData.get('enabled'),
  })
  if (!parsed.success) return { errors: { id: ['Missing id'] } }

  const [updated] = await db
    .update(propertyCosts)
    .set({ enabled: parsed.data.enabled === 'true', updatedAt: new Date() })
    .where(eq(propertyCosts.id, parsed.data.id))
    .returning({ propertyId: propertyCosts.propertyId })

  if (updated) revalidate(updated.propertyId)
  return { ok: true }
}

/**
 * Write one amount on a cost row.
 *
 * An empty value clears the field, which is how "reset to default" and "use
 * formula" work: clearing the override brings the calculated figure back rather
 * than writing the default in as a fixed number. Copying the default in would
 * silently freeze the cost against later changes to the definition.
 */
export async function setPropertyCostValue(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = propertyCostValueSchema.safeParse({
    id: formData.get('id'),
    field: formData.get('field'),
    value: String(formData.get('value') ?? ''),
  })
  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors,
      values: { value: String(formData.get('value') ?? '') },
    }
  }

  const { id, field, value } = parsed.data

  const [updated] = await db
    .update(propertyCosts)
    .set({ [field]: value, updatedAt: new Date() })
    .where(eq(propertyCosts.id, id))
    .returning({ propertyId: propertyCosts.propertyId })

  if (updated) revalidate(updated.propertyId)
  return { ok: true }
}

/**
 * Freeze the rates a completed purchase was calculated with.
 *
 * This is the whole of historical integrity. Once `completedAt` is set the
 * planner reads the snapshot instead of the live schedules, so editing a
 * schedule later, or adding next year's rates, cannot change what a purchase
 * already says it cost. The resolved brackets are copied, not just the id and
 * version, because a user can edit a schedule in place.
 */
export async function completePurchase(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const rawScheduleId = formData.get('scheduleId')
  const parsed = completePurchaseSchema.safeParse({
    id: formData.get('id'),
    scheduleId: rawScheduleId ? String(rawScheduleId) : null,
  })
  if (!parsed.success) return { errors: { id: ['Missing id'] } }

  const { id, scheduleId } = parsed.data

  const schedule = scheduleId
    ? await db.query.rateSchedules.findFirst({
        where: (table, { eq: equals }) => equals(table.id, scheduleId),
      })
    : undefined

  const snapshot: RateScheduleSnapshot | null = schedule
    ? {
        scheduleId: schedule.id,
        scheduleKey: schedule.key,
        name: schedule.name,
        version: schedule.version,
        effectiveFrom: schedule.effectiveFrom,
        effectiveTo: schedule.effectiveTo,
        currency: schedule.currency,
        brackets: schedule.brackets,
        takenAt: new Date().toISOString(),
      }
    : null

  await db
    .update(properties)
    .set({ completedAt: new Date(), rateScheduleSnapshot: snapshot, updatedAt: new Date() })
    .where(eq(properties.id, id))

  revalidate(id)
  return { ok: true }
}

/** Unfreeze a purchase so it follows the live schedules again. */
export async function reopenPurchase(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = propertyCostIdSchema.safeParse({ id: formData.get('id') })
  if (!parsed.success) return { errors: { id: ['Missing id'] } }

  await db
    .update(properties)
    .set({ completedAt: null, rateScheduleSnapshot: null, updatedAt: new Date() })
    .where(eq(properties.id, parsed.data.id))

  revalidate(parsed.data.id)
  return { ok: true }
}
