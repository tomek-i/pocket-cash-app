'use server'

import { asc, db, eq, type Tag, tags } from '@repo/database'
import { createTagSchema, updateTagSchema } from '@repo/validation'
import { revalidatePath } from 'next/cache'
import { type ActionState, isUniqueViolation } from '@/lib/action-state'

export async function listTags(): Promise<Tag[]> {
  return db.select().from(tags).orderBy(asc(tags.name))
}

export async function createTag(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = {
    name: String(formData.get('name') ?? ''),
    color: String(formData.get('color') ?? ''),
  }
  const parsed = createTagSchema.safeParse(values)
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors, values }

  try {
    await db.insert(tags).values({
      name: parsed.data.name,
      color: parsed.data.color ?? null,
    })
  } catch (error) {
    if (isUniqueViolation(error))
      return { errors: { name: ['A tag with this name already exists'] }, values }
    throw error
  }
  revalidatePath('/app/tags')
  return { ok: true }
}

export async function updateTag(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = {
    name: String(formData.get('name') ?? ''),
    color: String(formData.get('color') ?? ''),
  }
  const parsed = updateTagSchema.safeParse({ id: formData.get('id'), ...values })
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors, values }

  try {
    await db
      .update(tags)
      .set({ name: parsed.data.name, color: parsed.data.color ?? null, updatedAt: new Date() })
      .where(eq(tags.id, parsed.data.id))
  } catch (error) {
    if (isUniqueViolation(error))
      return { errors: { name: ['A tag with this name already exists'] }, values }
    throw error
  }
  revalidatePath('/app/tags')
  return { ok: true }
}

export async function deleteTag(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = formData.get('id')
  if (typeof id !== 'string') return { errors: { id: ['Missing id'] } }

  await db.delete(tags).where(eq(tags.id, id))
  revalidatePath('/app/tags')
  revalidatePath('/app/transactions')
  return { ok: true }
}
