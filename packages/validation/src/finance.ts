import {
  ACCOUNT_TYPES,
  BILLING_CYCLES,
  SUBSCRIPTION_KINDS,
  SUBSCRIPTION_STATUSES,
} from '@repo/types'
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
  kind: z.enum(SUBSCRIPTION_KINDS).default('subscription'),
  amount: amountMinor,
  currency: z.string().trim().length(3, 'Use a 3-letter currency code').toUpperCase(),
  cycle: z.enum(BILLING_CYCLES),
  nextPaymentDate: optionalIsoDate,
  categoryId: optionalUuid,
  matcher: optionalText(120),
  notes: optionalText(500),
  status: z.enum(SUBSCRIPTION_STATUSES).default('active'),
  /** Read only while paused. Empty means paused until resumed. */
  pausedUntil: optionalIsoDate,
  /** Read only while cancelled. Empty means it ends today. */
  endDate: optionalIsoDate,
})
export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>

export const updateSubscriptionSchema = createSubscriptionSchema.extend({ id: z.string().uuid() })
export type UpdateSubscriptionInput = z.infer<typeof updateSubscriptionSchema>

/** A quick status change from the subscription card. */
export const setSubscriptionStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(SUBSCRIPTION_STATUSES),
})
export type SetSubscriptionStatusInput = z.infer<typeof setSubscriptionStatusSchema>

// ── Budget ───────────────────────────────────────────────────────────────────

export const createBudgetIncomeSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(60),
  amount: amountMinor.refine((v) => v > 0, 'Enter an amount above zero'),
})
export type CreateBudgetIncomeInput = z.infer<typeof createBudgetIncomeSchema>

export const updateBudgetIncomeSchema = createBudgetIncomeSchema.extend({ id: z.string().uuid() })
export type UpdateBudgetIncomeInput = z.infer<typeof updateBudgetIncomeSchema>

/** A bucket's own name. Empty goes back to the default name. */
export const renameBudgetBucketSchema = z.object({
  type: z.string().trim().min(1),
  label: optionalText(40),
})
export type RenameBudgetBucketInput = z.infer<typeof renameBudgetBucketSchema>

/** Dialled shares in basis points. Bucket types are checked by `@repo/budget`. */
export const budgetSharesSchema = z
  .array(z.object({ type: z.string(), share: z.number().int().min(0).max(10_000) }))
  .min(1)

/** A category moved into a bucket, or out of every bucket with null. */
export const budgetCategoryAssignmentSchema = z.object({
  categoryId: z.string().uuid(),
  bucketType: z.string().nullable(),
})

// ── Workspace settings ─────────────────────────────────────────────────────────

export const updateSettingsSchema = z.object({
  defaultCurrency: z.string().trim().length(3, 'Use a 3-letter currency code').toUpperCase(),
  /** BCP-47 tag, or empty to follow the machine's own locale. */
  numberLocale: z
    .string()
    .trim()
    .max(35)
    .regex(/^[A-Za-z0-9-]*$/, 'Use a language tag like en-AU')
    .optional()
    .transform((value) => (value ? value : undefined)),
})
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>
