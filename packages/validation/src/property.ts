import { CALCULATION_BASES, CALCULATION_TYPES, FREQUENCIES, LOAN_TYPES } from '@repo/property'
import { COST_SCOPES, PROPERTY_STATUSES, PROPERTY_TYPES, PROPERTY_USES } from '@repo/types'
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

// ── Planner cost rows ────────────────────────────────────────────────────────

export const propertyCostIdSchema = z.object({ id: z.string().uuid() })

export const addPropertyCostSchema = z.object({
  propertyId: z.string().uuid(),
  costTypeId: z.string().uuid(),
})

export const togglePropertyCostSchema = z.object({
  id: z.string().uuid(),
  enabled: z.enum(['true', 'false']),
})

/**
 * One amount on a cost row.
 *
 * An empty value clears the field. That is how "reset to default" and "use
 * calculation" work: clearing the override brings the calculated figure back,
 * rather than writing the default in as a fixed number and freezing the cost
 * against later changes to its definition.
 */
export const propertyCostValueSchema = z.object({
  id: z.string().uuid(),
  field: z.enum(['overrideValue', 'manualValue', 'actualValue']),
  value: z
    .string()
    .trim()
    .transform((value) => value.replace(/[\s,$]/g, ''))
    .refine((value) => value === '' || /^\d+(\.\d{1,2})?$/.test(value), 'Enter an amount like 600')
    .transform((value) => (value === '' ? null : Math.round(Number.parseFloat(value) * 100))),
})

export const completePurchaseSchema = z.object({
  id: z.string().uuid(),
  scheduleId: z.string().uuid().nullable(),
})

// ── Ongoing costs and rental ─────────────────────────────────────────────────

export const addRecurringCostSchema = z.object({
  propertyId: z.string().uuid(),
  /** Optional link back to the seeded catalogue entry this came from. */
  costTypeId: z
    .string()
    .uuid()
    .optional()
    .or(z.literal('').transform(() => undefined)),
  name: z.string().trim().min(1, 'Name is required').max(120),
  category: z.string().trim().max(64).optional(),
  amount: optionalMoneyMinor,
  frequency: z.enum(FREQUENCIES),
})

export const updateRecurringCostSchema = z.object({
  id: z.string().uuid(),
  amount: optionalMoneyMinor,
  frequency: z.enum(FREQUENCIES),
})

export const recurringCostIdSchema = z.object({ id: z.string().uuid() })

export const toggleRecurringCostSchema = z.object({
  id: z.string().uuid(),
  enabled: z.enum(['true', 'false']),
})

export const rentalSchema = z.object({
  propertyId: z.string().uuid(),
  rent: optionalMoneyMinor,
  rentFrequency: z.enum(FREQUENCIES),
  vacancyRate: optionalPercentDecimal(100, 'Vacancy cannot exceed 100%'),
  managementRate: optionalPercentDecimal(100, 'Management cannot exceed 100%'),
})

// ── Settings: cost types ─────────────────────────────────────────────────────

/**
 * A cost type as edited in settings.
 *
 * Only name and default value are required. Everything else sits behind a
 * disclosure, because "Solar Inspection, $250" has to stay a two-field job: the
 * moment adding a cost needs a calculation type and a base, it stops being
 * something a user does and becomes something they ask a developer for.
 */
export const costTypeFieldsSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  defaultValue: optionalMoneyMinor,
  category: z.string().trim().max(64).optional(),
  scope: z.enum(COST_SCOPES),
  calculationType: z.enum(CALCULATION_TYPES),
  percentage: optionalPercentDecimal(1000, 'Enter a percentage like 1.2'),
  calculationBase: z
    .enum(CALCULATION_BASES)
    .optional()
    .or(z.literal('').transform(() => undefined)),
  formula: optionalText(500),
  defaultFrequency: z
    .enum(FREQUENCIES)
    .optional()
    .or(z.literal('').transform(() => undefined)),
  notes: optionalText(1000),
})

export const createCostTypeSchema = costTypeFieldsSchema
export const updateCostTypeSchema = costTypeFieldsSchema.extend({ id: z.string().uuid() })
export const costTypeIdSchema = z.object({ id: z.string().uuid() })
export const toggleCostTypeSchema = z.object({
  id: z.string().uuid(),
  enabled: z.enum(['true', 'false']),
})

// ── Settings: jurisdictions ──────────────────────────────────────────────────

export const jurisdictionFieldsSchema = z.object({
  /** Opaque key rate schedules match on, e.g. `AU-NSW`. */
  key: z
    .string()
    .trim()
    .min(2, 'Key is required')
    .max(64)
    .regex(/^[A-Za-z0-9_-]+$/, 'Use letters, digits, dashes or underscores'),
  name: z.string().trim().min(1, 'Name is required').max(120),
  country,
  region: optionalText(64),
  currency,
  transferTaxLabel: z.string().trim().min(1, 'A label is required').max(80),
})

export const createJurisdictionSchema = jurisdictionFieldsSchema
export const updateJurisdictionSchema = jurisdictionFieldsSchema.extend({ id: z.string().uuid() })
export const jurisdictionIdSchema = z.object({ id: z.string().uuid() })

// ── Settings: calculation defaults ───────────────────────────────────────────

export const propertyCalculationSettingsSchema = z.object({
  defaultLoanTermYears: optionalYears,
  defaultInterestRate: optionalPercentDecimal(100, 'Enter a rate like 6.25'),
  defaultDepositPercentage: optionalPercentDecimal(100, 'Deposit cannot exceed 100%'),
  defaultVacancyRate: optionalPercentDecimal(100, 'Vacancy cannot exceed 100%'),
  defaultManagementRate: optionalPercentDecimal(100, 'Management cannot exceed 100%'),
  /** Comma-separated percentages for the sensitivity table, e.g. "4, 5, 6, 7, 8". */
  sensitivityRates: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value : ''))
    .refine(
      (value) => value === '' || /^[\d.,\s%]+$/.test(value),
      'Use a comma-separated list like 4, 5, 6, 7, 8',
    )
    .transform((value) =>
      value === ''
        ? undefined
        : value
            .split(',')
            .map((part) => Number.parseFloat(part.replace('%', '').trim()))
            .filter((rate) => Number.isFinite(rate) && rate >= 0)
            .map((rate) => rate / 100),
    ),
})
