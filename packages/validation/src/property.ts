import { LOAN_TYPES } from '@repo/property'
import { PROPERTY_STATUSES, PROPERTY_TYPES, PROPERTY_USES } from '@repo/types'
import { z } from 'zod'

/**
 * Property form schemas.
 *
 * Two conversions matter here, because the form and the database disagree on
 * units on purpose. A user types major units ("950000") and percentages
 * ("6.25"); the database stores minor units and decimals, which is what the
 * calculation engine consumes. Both conversions happen once, here, so no
 * component or action has to remember them.
 */

/** Optional free text: empty string becomes undefined, stored as null. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined))

/** Money typed in major units ("950000", "950000.50") to integer minor units. */
const optionalMoneyMinor = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v.replace(/[\s,]/g, '') : ''))
  .refine(
    (v) => v === '' || /^\d+(\.\d{1,2})?$/.test(v),
    'Enter an amount like 950000 or 950000.50',
  )
  .transform((v) => (v === '' ? undefined : Math.round(Number.parseFloat(v) * 100)))

/**
 * A percentage typed as a human number ("6.25") to the decimal the engine wants
 * (0.0625). `max` is in percent, so 100 means "no more than 100%".
 */
const optionalPercentDecimal = (max: number, message: string) =>
  z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v.replace(',', '.').replace('%', '') : ''))
    .refine((v) => v === '' || /^\d+(\.\d{1,4})?$/.test(v), 'Enter a percentage like 6.25')
    .refine((v) => v === '' || Number.parseFloat(v) <= max, message)
    .transform((v) => (v === '' ? undefined : Number.parseFloat(v) / 100))

/** Optional whole number of years. */
const optionalYears = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : ''))
  .refine((v) => v === '' || /^\d{1,2}$/.test(v), 'Enter a whole number of years')
  .refine((v) => v === '' || Number.parseInt(v, 10) > 0, 'Must be at least 1 year')
  .transform((v) => (v === '' ? undefined : Number.parseInt(v, 10)))

/** Optional ISO date (YYYY-MM-DD); empty becomes undefined. */
const optionalIsoDate = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : ''))
  .refine((v) => v === '' || /^\d{4}-\d{2}-\d{2}$/.test(v), 'Use YYYY-MM-DD')
  .transform((v) => (v === '' ? undefined : v))

/** ISO-4217, upper-cased. */
const currency = z.string().trim().length(3, 'Use a 3-letter currency code').toUpperCase()

/** ISO-3166-1 alpha-2, upper-cased. */
const country = z.string().trim().length(2, 'Use a 2-letter country code').toUpperCase()

export const propertyFieldsSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  address: optionalText(300),

  /**
   * The jurisdiction key (e.g. `AU-NSW`), or empty for "other". When set, the
   * action copies that jurisdiction's country, region and currency onto the
   * property, so the two can never drift apart.
   */
  jurisdictionKey: optionalText(64),
  country,
  region: optionalText(64),
  currency,

  type: z.enum(PROPERTY_TYPES),
  intendedUse: z.enum(PROPERTY_USES),
  status: z.enum(PROPERTY_STATUSES),

  purchasePrice: optionalMoneyMinor,
  estimatedMarketValue: optionalMoneyMinor,
  currentValue: optionalMoneyMinor,
  originalPurchasePrice: optionalMoneyMinor,
  ownershipShare: optionalPercentDecimal(100, 'Ownership cannot exceed 100%'),
  purchaseDate: optionalIsoDate,
  notes: optionalText(2000),

  // Minimal financing, enough for the portfolio to show debt and equity. The
  // planner (#69) is where financing is modelled properly.
  loanAmount: optionalMoneyMinor,
  interestRate: optionalPercentDecimal(100, 'Enter a rate like 6.25'),
  loanTermYears: optionalYears,
  loanType: z.enum(LOAN_TYPES).optional(),
})

export const createPropertySchema = propertyFieldsSchema
export const updatePropertySchema = propertyFieldsSchema.extend({ id: z.string().uuid() })

export type PropertyFieldsInput = z.infer<typeof propertyFieldsSchema>

export const propertyIdSchema = z.object({ id: z.string().uuid() })

/**
 * The planner's financing panel.
 *
 * `source` names the field the user actually edited; the other two are derived
 * from it. Sending all three and letting the server guess is what makes a form
 * like this fight the user mid-typing.
 */
export const plannerFinancingSchema = z.object({
  id: z.string().uuid(),
  source: z.enum(['deposit', 'depositPercentage', 'loanAmount']),
  purchasePrice: optionalMoneyMinor,
  estimatedMarketValue: optionalMoneyMinor,
  deposit: optionalMoneyMinor,
  depositPercentage: optionalPercentDecimal(100, 'Deposit cannot exceed 100%'),
  loanAmount: optionalMoneyMinor,
  interestRate: optionalPercentDecimal(100, 'Enter a rate like 6.25'),
  loanTermYears: optionalYears,
  loanType: z.enum(LOAN_TYPES),
  offsetBalance: optionalMoneyMinor,
  otherFinancingCosts: optionalMoneyMinor,
})

/** The planner's property details panel. */
export const plannerDetailsSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1, 'Name is required').max(120),
  address: optionalText(300),
  jurisdictionKey: optionalText(64),
  country,
  region: optionalText(64),
  currency,
  type: z.enum(PROPERTY_TYPES),
  intendedUse: z.enum(PROPERTY_USES),
  status: z.enum(PROPERTY_STATUSES),
  purchaseDate: optionalIsoDate,
})
