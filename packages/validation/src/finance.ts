import { ACCOUNT_TYPES, BILLING_CYCLES } from '@repo/types'
import { z } from 'zod'

/** Optional free-text field: empty string → undefined (stored as null). */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined))

/** Optional hex colour (e.g. #22c55e); empty → undefined. */
const optionalHexColor = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Use a hex colour like #22c55e')
  .optional()
  .or(z.literal('').transform(() => undefined))

/** Optional uuid foreign key from a select; empty/sentinel → undefined. */
const optionalUuid = z
  .string()
  .uuid()
  .optional()
  .or(z.literal('').transform(() => undefined))

/** Optional ISO date (YYYY-MM-DD); empty → undefined. */
const optionalIsoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
  .optional()
  .or(z.literal('').transform(() => undefined))

/** A money amount entered as "9.99" / "9,99" → signed-free integer minor units. */
const amountMinor = z
  .string()
  .trim()
  .min(1, 'Amount is required')
  .transform((v) => v.replace(',', '.'))
  .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), 'Enter an amount like 9.99')
  .transform((v) => Math.round(Number.parseFloat(v) * 100))

// ── Banks ────────────────────────────────────────────────────────────────────

export const createBankSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80),
  country: z
    .string()
    .trim()
    .length(2, 'Use a 2-letter country code')
    .toUpperCase()
    .optional()
    .or(z.literal('').transform(() => undefined)),
  logoUrl: z
    .string()
    .trim()
    .url('Must be a valid URL')
    .optional()
    .or(z.literal('').transform(() => undefined)),
})
export type CreateBankInput = z.infer<typeof createBankSchema>

export const updateBankSchema = createBankSchema.extend({ id: z.string().uuid() })
export type UpdateBankInput = z.infer<typeof updateBankSchema>

// ── Branches ─────────────────────────────────────────────────────────────────

export const createBranchSchema = z.object({
  bankId: z.string().uuid(),
  name: z.string().trim().min(1, 'Name is required').max(80),
  sortCode: optionalText(20),
  routingNumber: optionalText(20),
})
export type CreateBranchInput = z.infer<typeof createBranchSchema>

export const updateBranchSchema = createBranchSchema.extend({ id: z.string().uuid() })
export type UpdateBranchInput = z.infer<typeof updateBranchSchema>

// ── Accounts ─────────────────────────────────────────────────────────────────

export const createAccountSchema = z.object({
  bankId: z.string().uuid(),
  branchId: z
    .string()
    .uuid()
    .optional()
    .or(z.literal('').transform(() => undefined)),
  name: z.string().trim().min(1, 'Name is required').max(80),
  type: z.enum(ACCOUNT_TYPES),
  currency: z.string().trim().length(3, 'Use a 3-letter currency code').toUpperCase(),
})
export type CreateAccountInput = z.infer<typeof createAccountSchema>

export const updateAccountSchema = createAccountSchema.extend({ id: z.string().uuid() })
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>

// ── Categories ───────────────────────────────────────────────────────────────

export const createCategorySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(60),
  color: optionalHexColor,
  icon: optionalText(40),
})
export type CreateCategoryInput = z.infer<typeof createCategorySchema>

export const updateCategorySchema = createCategorySchema.extend({ id: z.string().uuid() })
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>

// ── Tags ─────────────────────────────────────────────────────────────────────

export const createTagSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(40),
  color: optionalHexColor,
})
export type CreateTagInput = z.infer<typeof createTagSchema>

export const updateTagSchema = createTagSchema.extend({ id: z.string().uuid() })
export type UpdateTagInput = z.infer<typeof updateTagSchema>

// ── Financial subscriptions ────────────────────────────────────────────────────

export const createSubscriptionSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80),
  amount: amountMinor,
  currency: z.string().trim().length(3, 'Use a 3-letter currency code').toUpperCase(),
  cycle: z.enum(BILLING_CYCLES),
  nextPaymentDate: optionalIsoDate,
  categoryId: optionalUuid,
  matcher: optionalText(120),
  notes: optionalText(500),
})
export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>

export const updateSubscriptionSchema = createSubscriptionSchema.extend({ id: z.string().uuid() })
export type UpdateSubscriptionInput = z.infer<typeof updateSubscriptionSchema>

// ── Workspace settings ─────────────────────────────────────────────────────────

export const updateSettingsSchema = z.object({
  defaultCurrency: z.string().trim().length(3, 'Use a 3-letter currency code').toUpperCase(),
})
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>
