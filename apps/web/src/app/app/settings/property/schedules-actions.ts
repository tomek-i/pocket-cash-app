'use server'

import { asc, db, eq, type RateScheduleRow, rateSchedules } from '@repo/database'
import { type RateSchedule, validateRateSchedule } from '@repo/property'
import {
  createRateScheduleSchema,
  rateScheduleIdSchema,
  toggleRateScheduleSchema,
  updateRateScheduleSchema,
} from '@repo/validation'
import { revalidatePath } from 'next/cache'
import type { ActionState } from '@/lib/action-state'

/**
 * Rate schedules.
 *
 * A schedule that is subtly wrong is silently wrong: it still returns a number,
 * just the wrong one. So `validateRateSchedule` runs here as well as in the
 * editor. The editor's copy is for feedback while typing; this one is what
 * actually decides whether a schedule may be stored.
 */

function revalidate(): void {
  revalidatePath('/app/settings/property')
  revalidatePath('/app/property')
}

export async function listRateSchedules(): Promise<RateScheduleRow[]> {
  return db
    .select()
    .from(rateSchedules)
    .orderBy(asc(rateSchedules.jurisdictionKey), asc(rateSchedules.effectiveFrom))
}

function readValues(formData: FormData): Record<string, string> {
  const fields = [
    'name',
    'jurisdictionKey',
    'groupKey',
    'currency',
    'effectiveFrom',
    'effectiveTo',
    'notes',
    'brackets',
  ]
  return Object.fromEntries(fields.map((field) => [field, String(formData.get(field) ?? '')]))
}

/** The parsed fields as the engine's schedule, so the validator can run on them. */
function toEngineShape(data: {
  name: string
  jurisdictionKey: string
  currency: string
  effectiveFrom: string
  effectiveTo?: string
  brackets: RateSchedule['brackets']
}): RateSchedule {
  return {
    id: 'pending',
    name: data.name,
    jurisdiction: data.jurisdictionKey,
    country: '',
    region: null,
    currency: data.currency,
    effectiveFrom: data.effectiveFrom,
    effectiveTo: data.effectiveTo ?? null,
    calculationType: 'bracketed',
    version: 1,
    brackets: data.brackets,
  }
}

/** Validation errors as the shape the forms render. */
function bracketErrors(schedule: RateSchedule): Record<string, string[]> | null {
  const result = validateRateSchedule(schedule)
  const errors = result.issues.filter((issue) => issue.severity === 'error')
  if (errors.length === 0) return null
  return {
    brackets: errors.map((issue) =>
      issue.bracketIndex === undefined
        ? issue.message
        : `Bracket ${issue.bracketIndex + 1}: ${issue.message}`,
    ),
  }
}

export async function createRateSchedule(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const values = readValues(formData)
  const parsed = createRateScheduleSchema.safeParse(values)
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors, values }

  const data = parsed.data
  const errors = bracketErrors(toEngineShape(data))
  if (errors) return { errors, values }

  await db.insert(rateSchedules).values({
    name: data.name,
    jurisdictionKey: data.jurisdictionKey,
    groupKey: data.groupKey,
    currency: data.currency,
    effectiveFrom: data.effectiveFrom,
    effectiveTo: data.effectiveTo ?? null,
    brackets: data.brackets,
    notes: data.notes ?? null,
    version: 1,
    isSystem: false,
  })

  revalidate()
  return { ok: true }
}

/**
 * Save a schedule, bumping `version` when the brackets actually change.
 *
 * The version is not decoration: a completed purchase stores the id and version
 * it used, so an edit that changes the numbers has to be a new version for that
 * record to still mean something. Renaming a schedule or fixing a typo in the
 * notes leaves the version alone.
 */
export async function updateRateSchedule(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const values = readValues(formData)
  const parsed = updateRateScheduleSchema.safeParse({ id: formData.get('id'), ...values })
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors, values }

  const data = parsed.data
  const errors = bracketErrors(toEngineShape(data))
  if (errors) return { errors, values }

  const existing = await db.query.rateSchedules.findFirst({
    where: eq(rateSchedules.id, data.id),
  })
  if (!existing) return { errors: { id: ['That schedule no longer exists'] }, values }

  const bracketsChanged =
    JSON.stringify(existing.brackets) !== JSON.stringify(data.brackets) ||
    existing.effectiveFrom !== data.effectiveFrom ||
    existing.effectiveTo !== (data.effectiveTo ?? null)

  await db
    .update(rateSchedules)
    .set({
      name: data.name,
      jurisdictionKey: data.jurisdictionKey,
      groupKey: data.groupKey,
      currency: data.currency,
      effectiveFrom: data.effectiveFrom,
      effectiveTo: data.effectiveTo ?? null,
      brackets: data.brackets,
      notes: data.notes ?? null,
      version: bracketsChanged ? existing.version + 1 : existing.version,
      updatedAt: new Date(),
    })
    .where(eq(rateSchedules.id, data.id))

  revalidate()
  return { ok: true }
}

/**
 * Copy a schedule, which is the usual way a new financial year starts.
 *
 * The copy is disabled and its dates are cleared of an end, so it cannot
 * accidentally become a second schedule effective at the same time as the one it
 * came from.
 */
export async function duplicateRateSchedule(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = rateScheduleIdSchema.safeParse({ id: formData.get('id') })
  if (!parsed.success) return { errors: { id: ['Missing id'] } }

  const source = await db.query.rateSchedules.findFirst({
    where: eq(rateSchedules.id, parsed.data.id),
  })
  if (!source) return { errors: { id: ['That schedule no longer exists'] } }

  await db.insert(rateSchedules).values({
    name: `${source.name} (copy)`,
    jurisdictionKey: source.jurisdictionKey,
    groupKey: source.groupKey,
    currency: source.currency,
    effectiveFrom: source.effectiveFrom,
    effectiveTo: source.effectiveTo,
    brackets: source.brackets,
    notes: source.notes,
    version: 1,
    isSystem: false,
    enabled: false,
  })

  revalidate()
  return { ok: true }
}

export async function toggleRateSchedule(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = toggleRateScheduleSchema.safeParse({
    id: formData.get('id'),
    enabled: formData.get('enabled'),
  })
  if (!parsed.success) return { errors: { id: ['Missing id'] } }

  await db
    .update(rateSchedules)
    .set({ enabled: parsed.data.enabled === 'true', updatedAt: new Date() })
    .where(eq(rateSchedules.id, parsed.data.id))

  revalidate()
  return { ok: true }
}

export async function deleteRateSchedule(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = rateScheduleIdSchema.safeParse({ id: formData.get('id') })
  if (!parsed.success) return { errors: { id: ['Missing id'] } }

  await db.delete(rateSchedules).where(eq(rateSchedules.id, parsed.data.id))
  revalidate()
  return { ok: true }
}
