'use server'

import {
  asc,
  db,
  eq,
  max,
  type PropertyAvailableFund,
  propertyAvailableFunds,
} from '@repo/database'
import {
  availableFundIdSchema,
  createAvailableFundSchema,
  toggleAvailableFundSchema,
  updateAvailableFundSchema,
} from '@repo/validation'
import { revalidatePath } from 'next/cache'
import type { ActionState } from '@/lib/action-state'

/**
 * Money available towards a purchase.
 *
 * Funds are held against no particular property (`propertyId` stays null), which
 * is why the list is the same on every planner: savings are the user's, not the
 * property's. That also makes them useful for the thing the planner is for,
 * comparing what several purchases would leave you with.
 *
 * Entered by hand. Nothing here reads an account balance, deliberately: see the
 * doc comment on the table.
 */

function revalidate(): void {
  revalidatePath('/app/property', 'layout')
}

/** Every fund the user has recorded, in display order. */
export async function listAvailableFunds(): Promise<PropertyAvailableFund[]> {
  return db.select().from(propertyAvailableFunds).orderBy(asc(propertyAvailableFunds.sortOrder))
}

export async function addAvailableFund(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const values = {
    label: String(formData.get('label') ?? ''),
    amount: String(formData.get('amount') ?? ''),
  }
  const parsed = createAvailableFundSchema.safeParse(values)
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors, values }

  const [{ value: highest } = { value: null }] = await db
    .select({ value: max(propertyAvailableFunds.sortOrder) })
    .from(propertyAvailableFunds)

  await db.insert(propertyAvailableFunds).values({
    label: parsed.data.label,
    amount: parsed.data.amount ?? 0,
    sortOrder: (highest ?? 0) + 1,
  })

  revalidate()
  return { ok: true }
}

export async function updateAvailableFund(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const values = {
    id: String(formData.get('id') ?? ''),
    label: String(formData.get('label') ?? ''),
    amount: String(formData.get('amount') ?? ''),
  }
  const parsed = updateAvailableFundSchema.safeParse(values)
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors, values }

  await db
    .update(propertyAvailableFunds)
    .set({
      label: parsed.data.label,
      amount: parsed.data.amount ?? 0,
      updatedAt: new Date(),
    })
    .where(eq(propertyAvailableFunds.id, parsed.data.id))

  revalidate()
  return { ok: true }
}

/** Turn a fund off without deleting it, e.g. money earmarked for something else. */
export async function toggleAvailableFund(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = toggleAvailableFundSchema.safeParse({
    id: formData.get('id'),
    enabled: formData.get('enabled'),
  })
  if (!parsed.success) return { errors: { id: ['Missing id'] } }

  await db
    .update(propertyAvailableFunds)
    .set({ enabled: parsed.data.enabled === 'true', updatedAt: new Date() })
    .where(eq(propertyAvailableFunds.id, parsed.data.id))

  revalidate()
  return { ok: true }
}

export async function removeAvailableFund(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = availableFundIdSchema.safeParse({ id: formData.get('id') })
  if (!parsed.success) return { errors: { id: ['Missing id'] } }

  await db.delete(propertyAvailableFunds).where(eq(propertyAvailableFunds.id, parsed.data.id))
  revalidate()
  return { ok: true }
}
