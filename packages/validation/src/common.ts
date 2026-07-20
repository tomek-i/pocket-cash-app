import { MAX_PAGE_LIMIT } from '@repo/types'
import { z } from 'zod'

/** Reusable field schemas shared across feature schemas. */
export const email = z.string().trim().toLowerCase().email()

export const slug = z
  .string()
  .trim()
  .min(2)
  .max(48)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Must be lowercase alphanumeric with single hyphens')

export const nonEmptyString = z.string().trim().min(1)

/** Cursor pagination query, safe to parse directly from URL search params. */
export const pageParamsSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().max(MAX_PAGE_LIMIT).optional(),
})

export type PageParamsInput = z.infer<typeof pageParamsSchema>
