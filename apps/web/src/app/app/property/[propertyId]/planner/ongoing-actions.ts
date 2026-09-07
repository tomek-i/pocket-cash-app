'use server'

import {
  and,
  asc,
  type CostType,
  costTypes,
  db,
  eq,
  isNull,
  max,
  type PropertyRecurringCost,
  type PropertyRental,
  propertyRecurringCosts,
  propertyRentals,
} from '@repo/database'
import {
  addRecurringCostSchema,
  recurringCostIdSchema,
  rentalSchema,
  toggleRecurringCostSchema,
  updateRecurringCostSchema,
} from '@repo/validation'
import { revalidatePath } from 'next/cache'
import type { ActionState } from '@/lib/action-state'

/**
 * Ongoing holding costs and rental assumptions.
 *
 * A recurring cost carries its own name and amount rather than deriving them
 * from a cost type, because holding costs are mostly one-off entries a user
 * types in. `costTypeId` only records which catalogue entry it started from.
 */

function revalidate(propertyId: string): void {
  revalidatePath(`/app/property/${propertyId}/planner`)
}

export async function listRecurringCosts(propertyId: string): Promise<PropertyRecurringCost[]> {
  return db
    .select()
    .from(propertyRecurringCosts)
    .where(eq(propertyRecurringCosts.propertyId, propertyId))
    .orderBy(asc(propertyRecurringCosts.sortOrder))
}

export async function getRental(propertyId: string): Promise<PropertyRental | undefined> {
  return db.query.propertyRentals.findFirst({
    where: eq(propertyRentals.propertyId, propertyId),
  })
}

/** The seeded holding-cost catalogue, for the add dialog. */
export async function listRecurringCostTypes(): Promise<CostType[]> {
  return db
    .select()
    .from(costTypes)
    .where(
      and(
        eq(costTypes.scope, 'recurring'),
        eq(costTypes.enabled, true),
        isNull(costTypes.deletedAt),
      ),
    )
    .orderBy(asc(costTypes.category), asc(costTypes.name))
}

export async function addRecurringCost(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const values = {
    propertyId: String(formData.get('propertyId') ?? ''),
    costTypeId: String(formData.get('costTypeId') ?? ''),
    name: String(formData.get('name') ?? ''),
    category: String(formData.get('category') ?? 'other'),
    amount: String(formData.get('amount') ?? ''),
    frequency: String(formData.get('frequency') ?? 'monthly'),
  }
  const parsed = addRecurringCostSchema.safeParse(values)
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors, values }

  const data = parsed.data

  const [{ value: highest } = { value: null }] = await db
    .select({ value: max(propertyRecurringCosts.sortOrder) })
    .from(propertyRecurringCosts)
    .where(eq(propertyRecurringCosts.propertyId, data.propertyId))

  await db.insert(propertyRecurringCosts).values({
    propertyId: data.propertyId,
    costTypeId: data.costTypeId ?? null,
    name: data.name,
    category: data.category || 'other',
    amount: data.amount ?? 0,
    frequency: data.frequency,
    sortOrder: (highest ?? 0) + 1,
  })

  revalidate(data.propertyId)
  return { ok: true }
}

export async function updateRecurringCost(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const values = {
    id: String(formData.get('id') ?? ''),
    amount: String(formData.get('amount') ?? ''),
    frequency: String(formData.get('frequency') ?? 'monthly'),
  }
  const parsed = updateRecurringCostSchema.safeParse(values)
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors, values }

  const [updated] = await db
    .update(propertyRecurringCosts)
    .set({
      amount: parsed.data.amount ?? 0,
      frequency: parsed.data.frequency,
      updatedAt: new Date(),
    })
    .where(eq(propertyRecurringCosts.id, parsed.data.id))
    .returning({ propertyId: propertyRecurringCosts.propertyId })

  if (updated) revalidate(updated.propertyId)
  return { ok: true }
}

export async function toggleRecurringCost(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = toggleRecurringCostSchema.safeParse({
    id: formData.get('id'),
    enabled: formData.get('enabled'),
  })
  if (!parsed.success) return { errors: { id: ['Missing id'] } }

  const [updated] = await db
    .update(propertyRecurringCosts)
    .set({ enabled: parsed.data.enabled === 'true', updatedAt: new Date() })
    .where(eq(propertyRecurringCosts.id, parsed.data.id))
    .returning({ propertyId: propertyRecurringCosts.propertyId })

  if (updated) revalidate(updated.propertyId)
  return { ok: true }
}

export async function removeRecurringCost(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = recurringCostIdSchema.safeParse({ id: formData.get('id') })
  if (!parsed.success) return { errors: { id: ['Missing id'] } }

  const [removed] = await db
    .delete(propertyRecurringCosts)
    .where(eq(propertyRecurringCosts.id, parsed.data.id))
    .returning({ propertyId: propertyRecurringCosts.propertyId })

  if (removed) revalidate(removed.propertyId)
  return { ok: true }
}

/** Save the rental assumptions. One row per property, created on first save. */
export async function saveRental(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = {
    propertyId: String(formData.get('propertyId') ?? ''),
    rent: String(formData.get('rent') ?? ''),
    rentFrequency: String(formData.get('rentFrequency') ?? 'weekly'),
    vacancyRate: String(formData.get('vacancyRate') ?? ''),
    managementRate: String(formData.get('managementRate') ?? ''),
  }
  const parsed = rentalSchema.safeParse(values)
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors, values }

  const data = parsed.data
  const record = {
    rent: data.rent ?? 0,
    rentFrequency: data.rentFrequency,
    vacancyRate: data.vacancyRate ?? 0,
    managementRate: data.managementRate ?? 0,
  }

  const existing = await db.query.propertyRentals.findFirst({
    where: eq(propertyRentals.propertyId, data.propertyId),
  })

  if (existing) {
    await db
      .update(propertyRentals)
      .set({ ...record, updatedAt: new Date() })
      .where(eq(propertyRentals.id, existing.id))
  } else {
    await db.insert(propertyRentals).values({ propertyId: data.propertyId, ...record })
  }

  revalidate(data.propertyId)
  return { ok: true }
}
