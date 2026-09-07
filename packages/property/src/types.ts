/**
 * Shared vocabulary for the property engine.
 *
 * Two rules hold everywhere in this package:
 *
 * 1. **Money is a signed integer in minor units** (cents for a 2-decimal
 *    currency), exactly like `transactions.amount`. Never a float.
 * 2. **Rates and percentages are decimals**: `0.045` is 4.5%. Never a string,
 *    never 4.5.
 *
 * Nothing here knows about any particular country, tax or fee. A jurisdiction
 * supplies data; the engine only applies it.
 */

/** How a bracket turns a value into an amount. */
export type RateUnit =
  /** `baseAmount + (value - minimum) * rate` */
  | 'percentage'
  /** `baseAmount`, a flat charge for anything landing in this bracket. */
  | 'fixed'
  /** `baseAmount + ceil((value - minimum) / unitSize) * rate`, e.g. "$3 per $100". */
  | 'perUnit'

/**
 * One band of a progressive schedule.
 *
 * `minimum` is **inclusive** and `maximum` is **exclusive**, so exactly one
 * bracket matches any value. A published table written as "$18,001 to $38,000"
 * is expressed as `minimum: 18_000_00, maximum: 38_000_00`: at the shared
 * boundary both neighbours produce the same amount for a well-formed schedule,
 * so which one matches does not change the result.
 *
 * The last bracket has `maximum: null`, meaning unlimited.
 */
export interface RateBracket {
  /** Inclusive lower bound, minor units. Never negative. */
  minimum: number
  /** Exclusive upper bound, minor units. `null` marks the unlimited final bracket. */
  maximum: number | null
  /** Flat amount charged on entering this bracket, minor units. */
  baseAmount: number
  /** Decimal rate applied above `minimum`. `0.045` is 4.5%. */
  rate: number
  rateUnit: RateUnit
  /** Floor applied after calculating, minor units. Optional. */
  minimumCharge?: number
  /** Size of one chargeable unit for `perUnit`, minor units. Defaults to 1. */
  unitSize?: number
}

/**
 * A dated, versioned set of brackets for one jurisdiction. Transfer duty is the
 * first user of this, but nothing here is duty-specific: land tax, registration
 * fees and any other progressive charge use the same shape.
 */
export interface RateSchedule {
  id: string
  name: string
  /** Opaque jurisdiction key, e.g. `AU-NSW`. Matched by equality, never parsed. */
  jurisdiction: string
  country: string
  region: string | null
  /** ISO-4217. */
  currency: string
  /** Inclusive, `YYYY-MM-DD`. */
  effectiveFrom: string
  /** Inclusive, `YYYY-MM-DD`. `null` means open ended. */
  effectiveTo: string | null
  calculationType: 'bracketed'
  /**
   * Bumped whenever the brackets change. A completed purchase stores the id and
   * version it used so later edits cannot rewrite history.
   */
  version: number
  enabled?: boolean
  brackets: RateBracket[]
}

/** How a cost produces its amount. */
export type CalculationType = 'fixed' | 'percentage' | 'formula' | 'bracketed' | 'manual'

/** The figure a percentage, formula or bracketed cost is calculated against. */
export type CalculationBase =
  | 'purchasePrice'
  | 'propertyValue'
  | 'loanAmount'
  | 'deposit'
  | 'dutiableValue'

/** The variables a cost calculation and a user formula may read. */
export interface CalculationContext {
  /** Minor units. */
  purchasePrice: number
  /** Minor units. */
  propertyValue: number
  /** Minor units. */
  loanAmount: number
  /** Minor units. */
  deposit: number
  /** Minor units. Usually the purchase price, but a jurisdiction may differ. */
  dutiableValue: number
  /** Decimal ratio, `0.8` is 80%. */
  lvr: number
  /** Decimal annual rate, `0.062` is 6.2%. */
  interestRate: number
}

/** How often a recurring amount is charged. */
export type Frequency =
  | 'weekly'
  | 'fortnightly'
  | 'monthly'
  | 'quarterly'
  | 'halfYearly'
  | 'annual'
  | 'custom'

/** Repayment structure of a loan. */
export type LoanType = 'principalAndInterest' | 'interestOnly'

/** A recoverable failure. The engine returns these rather than throwing. */
export interface EngineError {
  code: string
  message: string
}

/** Result wrapper for operations that can fail on user-supplied configuration. */
export type EngineResult<T> = { ok: true; value: T } | { ok: false; error: EngineError }

/** Build a failure result. */
export function fail<T>(code: string, message: string): EngineResult<T> {
  return { ok: false, error: { code, message } }
}

/** Build a success result. */
export function ok<T>(value: T): EngineResult<T> {
  return { ok: true, value }
}
