'use server'

import { asc, type Bank, banks, db, eq } from '@repo/database'
import { createBankSchema, updateBankSchema } from '@repo/validation'
import { revalidatePath } from 'next/cache'

export type ActionState = {
  ok?: boolean
  errors?: Record<string, string[] | undefined>
  // The submitted field values, echoed back so the form can repopulate after a
  // failed submit. React 19 resets uncontrolled form fields once the action
  // returns, so without this the user's input is lost on a validation error.
  values?: Record<string, string>
} | null

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === '23505'
  )
}

export async function listBanks(): Promise<Bank[]> {
  return db.select().from(banks).orderBy(asc(banks.name))
}

export async function getBank(id: string): Promise<Bank | undefined> {
  return db.query.banks.findFirst({ where: eq(banks.id, id) })
}

export async function createBank(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = {
    name: String(formData.get('name') ?? ''),
    country: String(formData.get('country') ?? ''),
    logoUrl: String(formData.get('logoUrl') ?? ''),
  }
  const parsed = createBankSchema.safeParse(values)
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors, values }

  try {
    await db.insert(banks).values({
      name: parsed.data.name,
      country: parsed.data.country ?? null,
      logoUrl: parsed.data.logoUrl ?? null,
    })
  } catch (error) {
    if (isUniqueViolation(error))
      return { errors: { name: ['A bank with this name already exists'] }, values }
    throw error
  }
  revalidatePath('/app/banks')
  return { ok: true }
}

export async function updateBank(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = {
    name: String(formData.get('name') ?? ''),
    country: String(formData.get('country') ?? ''),
    logoUrl: String(formData.get('logoUrl') ?? ''),
  }
  const parsed = updateBankSchema.safeParse({ id: formData.get('id'), ...values })
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors, values }

  try {
    await db
      .update(banks)
      .set({
        name: parsed.data.name,
        country: parsed.data.country ?? null,
        logoUrl: parsed.data.logoUrl ?? null,
        updatedAt: new Date(),
      })
      .where(eq(banks.id, parsed.data.id))
  } catch (error) {
    if (isUniqueViolation(error))
      return { errors: { name: ['A bank with this name already exists'] }, values }
    throw error
  }
  revalidatePath('/app/banks')
  return { ok: true }
}

export async function deleteBank(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = formData.get('id')
  if (typeof id !== 'string') return { errors: { id: ['Missing id'] } }

  await db.delete(banks).where(eq(banks.id, id))
  revalidatePath('/app/banks')
  return { ok: true }
}
