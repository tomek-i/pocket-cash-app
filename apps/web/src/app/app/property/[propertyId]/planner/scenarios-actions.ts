'use server'

import {
  and,
  asc,
  db,
  eq,
  gt,
  max,
  type PropertyScenario,
  propertyScenarios,
  type ScenarioOverrides,
  sql,
} from '@repo/database'
import {
  createScenarioSchema,
  type ScenarioFormInput,
  scenarioIdSchema,
  updateScenarioSchema,
} from '@repo/validation'
import { revalidatePath } from 'next/cache'
import type { ActionState } from '@/lib/action-state'

/**
 * Named what-ifs over one property.
 *
 * A scenario stores only what it *changes*. Everything it says nothing about
 * keeps following the base property, so correcting the rate or adding a cost
 * updates every scenario at once instead of leaving four stale copies behind.
 * That is why the overrides are a sparse jsonb object rather than a second row
 * of property columns.
 */

function revalidate(): void {
  revalidatePath('/app/property', 'layout')
}

/** Read the form fields into overrides, dropping the ones left blank. */
function toOverrides(parsed: ScenarioFormInput): ScenarioOverrides {
  const { name: _name, ...fields } = parsed
  const overrides: ScenarioOverrides = {}

  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) overrides[key as keyof ScenarioOverrides] = value
  }

  return overrides
}

function readForm(formData: FormData): Record<string, string> {
  return {
    name: String(formData.get('name') ?? ''),
    purchasePrice: String(formData.get('purchasePrice') ?? ''),
    estimatedMarketValue: String(formData.get('estimatedMarketValue') ?? ''),
    deposit: String(formData.get('deposit') ?? ''),
    depositPercentage: String(formData.get('depositPercentage') ?? ''),
    loanAmount: String(formData.get('loanAmount') ?? ''),
    annualRate: String(formData.get('annualRate') ?? ''),
    termYears: String(formData.get('termYears') ?? ''),
    rent: String(formData.get('rent') ?? ''),
  }
}

/** Every scenario on a property, in display order. */
export async function listScenarios(propertyId: string): Promise<PropertyScenario[]> {
  return db
    .select()
    .from(propertyScenarios)
    .where(eq(propertyScenarios.propertyId, propertyId))
    .orderBy(asc(propertyScenarios.sortOrder), asc(propertyScenarios.createdAt))
}

export async function addScenario(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = { ...readForm(formData), propertyId: String(formData.get('propertyId') ?? '') }
  const parsed = createScenarioSchema.safeParse(values)
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors, values }

  const [{ value: highest } = { value: null }] = await db
    .select({ value: max(propertyScenarios.sortOrder) })
    .from(propertyScenarios)
    .where(eq(propertyScenarios.propertyId, parsed.data.propertyId))

  await db.insert(propertyScenarios).values({
    propertyId: parsed.data.propertyId,
    name: parsed.data.name,
    overrides: toOverrides(parsed.data),
    sortOrder: (highest ?? 0) + 1,
  })

  revalidate()
  return { ok: true }
}

export async function updateScenario(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = { ...readForm(formData), id: String(formData.get('id') ?? '') }
  const parsed = updateScenarioSchema.safeParse(values)
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors, values }

  await db
    .update(propertyScenarios)
    .set({
      name: parsed.data.name,
      // Replaced wholesale rather than merged: a field the user cleared has to
      // stop overriding, and a merge would keep the old value forever.
      overrides: toOverrides(parsed.data),
      updatedAt: new Date(),
    })
    .where(eq(propertyScenarios.id, parsed.data.id))

  revalidate()
  return { ok: true }
}

/** Copy a scenario, for varying one more thing without losing the original. */
export async function duplicateScenario(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = scenarioIdSchema.safeParse({ id: formData.get('id') })
  if (!parsed.success) return { errors: { id: ['Missing id'] } }

  const [source] = await db
    .select()
    .from(propertyScenarios)
    .where(eq(propertyScenarios.id, parsed.data.id))
    .limit(1)
  if (!source) return { errors: { id: ['That scenario no longer exists'] } }

  // Slot the copy in beside its original rather than at the end. A duplicate is
  // made to vary one more thing, so the two want to be read next to each other.
  await db.transaction(async (tx) => {
    await tx
      .update(propertyScenarios)
      .set({ sortOrder: sql`${propertyScenarios.sortOrder} + 1` })
      .where(
        and(
          eq(propertyScenarios.propertyId, source.propertyId),
          gt(propertyScenarios.sortOrder, source.sortOrder),
        ),
      )

    await tx.insert(propertyScenarios).values({
      propertyId: source.propertyId,
      name: `${source.name} copy`.slice(0, 80),
      overrides: source.overrides,
      sortOrder: source.sortOrder + 1,
    })
  })

  revalidate()
  return { ok: true }
}

export async function removeScenario(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = scenarioIdSchema.safeParse({ id: formData.get('id') })
  if (!parsed.success) return { errors: { id: ['Missing id'] } }

  await db.delete(propertyScenarios).where(eq(propertyScenarios.id, parsed.data.id))
  revalidate()
  return { ok: true }
}
