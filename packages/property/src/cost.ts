/**
 * Turning a cost type plus its per-property state into an amount.
 *
 * The important separation lives here. A **cost type** is the reusable
 * definition ("Building Inspection, normally $600"). A **cost state** is what
 * this one property says about it ("actually $750"). The two are combined at
 * read time, so overriding a cost on one property never edits the definition
 * everyone else uses.
 */

import type { BracketBreakdown } from './brackets'
import { calculateBracketed } from './brackets'
import { evaluateFormula } from './formula'
import type {
  CalculationBase,
  CalculationContext,
  CalculationType,
  EngineError,
  RateSchedule,
} from './types'

/** The reusable definition of a cost. System seeded or user created. */
export interface CostDefinition {
  id: string
  name: string
  /** Free-form category key, for grouping and filtering. */
  category: string
  calculationType: CalculationType
  /** Minor units. The default for a `fixed` cost. */
  defaultValue?: number
  /** Decimal, `0.012` is 1.2%. For a `percentage` cost. */
  percentage?: number
  /** What a `percentage` or `bracketed` cost is calculated against. */
  calculationBase?: CalculationBase
  /** Expression for a `formula` cost. See `formula.ts` for the grammar. */
  formula?: string
  /** Which rate schedule a `bracketed` cost uses. */
  rateScheduleId?: string
  /** ISO-4217. Inherited from the property when unset. */
  currency?: string
  notes?: string
}

/** What one property says about one cost. */
export interface CostState {
  enabled: boolean
  /** Minor units. The entered amount for a `manual` cost. */
  manualValue?: number | null
  /** Minor units. A user override, which wins over the calculated value. */
  overrideValue?: number | null
  /** Minor units. The real amount, once it is known. */
  actualValue?: number | null
}

/** Which figure the totals should use. */
export type CostBasis = 'estimate' | 'actual'

export interface CostEvaluationOptions {
  /** Available schedules, needed by `bracketed` costs. */
  schedules?: RateSchedule[]
  /** Purchase date, `YYYY-MM-DD`, used to pick the effective schedule. */
  date?: string
  /** Defaults to `estimate`. `actual` uses the real amount wherever it is known. */
  basis?: CostBasis
}

/** How an amount was arrived at, for the "Calculation details" panel. */
export type CostBreakdown =
  | { kind: 'fixed'; defaultValue: number }
  | { kind: 'manual' }
  | { kind: 'percentage'; percentage: number; base: CalculationBase; baseValue: number }
  | { kind: 'formula'; formula: string }
  | {
      kind: 'bracketed'
      schedule: RateSchedule
      base: CalculationBase
      baseValue: number
      bracket: BracketBreakdown
    }
  | { kind: 'unavailable' }

export interface CostResult {
  id: string
  name: string
  category: string
  enabled: boolean
  calculationType: CalculationType
  /** True for percentage, formula and bracketed costs. Drives the "calculated automatically" label. */
  automatic: boolean
  /** What the engine worked out, minor units. `null` when it could not. */
  calculatedValue: number | null
  /** The estimate in force: the override when there is one, otherwise the calculated value. */
  estimate: number
  /** The real amount, minor units, once recorded. */
  actual: number | null
  /** The amount totals use, honouring `basis`. Minor units. */
  amount: number
  /** True when a user override is in force. */
  overridden: boolean
  breakdown: CostBreakdown
  /** Set when the cost could not be calculated. The row still renders. */
  error?: EngineError
}

/** Read a calculation base out of the context. */
export function resolveBase(base: CalculationBase, context: CalculationContext): number {
  return context[base]
}

/**
 * Evaluate one cost. Always returns a result: a cost that cannot be calculated
 * carries an `error` and an amount of 0, because dropping the row would hide the
 * problem from the user entirely.
 */
export function calculateCost(
  definition: CostDefinition,
  state: CostState,
  context: CalculationContext,
  options: CostEvaluationOptions = {},
): CostResult {
  const automatic =
    definition.calculationType === 'percentage' ||
    definition.calculationType === 'formula' ||
    definition.calculationType === 'bracketed'

  let calculatedValue: number | null = null
  let breakdown: CostBreakdown = { kind: 'unavailable' }
  let error: EngineError | undefined

  switch (definition.calculationType) {
    case 'fixed': {
      calculatedValue = definition.defaultValue ?? 0
      breakdown = { kind: 'fixed', defaultValue: calculatedValue }
      break
    }

    case 'manual': {
      calculatedValue = null
      breakdown = { kind: 'manual' }
      break
    }

    case 'percentage': {
      const base = definition.calculationBase ?? 'purchasePrice'
      const baseValue = resolveBase(base, context)
      const percentage = definition.percentage ?? 0
      calculatedValue = Math.round(baseValue * percentage)
      breakdown = { kind: 'percentage', percentage, base, baseValue }
      break
    }

    case 'formula': {
      const formula = definition.formula ?? ''
      const evaluated = evaluateFormula(formula, context)
      if (evaluated.ok) {
        calculatedValue = Math.round(evaluated.value)
        breakdown = { kind: 'formula', formula }
      } else {
        error = evaluated.error
      }
      break
    }

    case 'bracketed': {
      const base = definition.calculationBase ?? 'dutiableValue'
      const baseValue = resolveBase(base, context)
      const schedule = (options.schedules ?? []).find((s) => s.id === definition.rateScheduleId)

      if (!schedule) {
        error = {
          code: 'SCHEDULE_NOT_FOUND',
          message: `"${definition.name}" needs rate schedule "${definition.rateScheduleId ?? 'none'}", which is not available.`,
        }
        break
      }

      const bracketed = calculateBracketed(schedule, baseValue)
      if (bracketed.ok) {
        calculatedValue = bracketed.value.total
        breakdown = { kind: 'bracketed', schedule, base, baseValue, bracket: bracketed.value }
      } else {
        error = bracketed.error
      }
      break
    }
  }

  const override = state.overrideValue ?? null
  const manual = state.manualValue ?? null
  const overridden = override !== null

  // Precedence: an explicit override wins, then the calculated value, then the
  // manually entered amount. A manual cost has no calculated value, so it falls
  // straight through to what the user typed.
  const estimate = override ?? calculatedValue ?? manual ?? 0
  const actual = state.actualValue ?? null
  const basis = options.basis ?? 'estimate'

  return {
    id: definition.id,
    name: definition.name,
    category: definition.category,
    enabled: state.enabled,
    calculationType: definition.calculationType,
    automatic,
    calculatedValue,
    estimate,
    actual,
    amount: basis === 'actual' ? (actual ?? estimate) : estimate,
    overridden,
    breakdown,
    error,
  }
}

export interface CostSummary {
  /** Minor units. Enabled costs only. */
  total: number
  /** Minor units, keyed by category. Enabled costs only. */
  byCategory: Record<string, number>
  /** Costs that failed to calculate, so the UI can surface them. */
  errors: CostResult[]
}

/** Total a list of evaluated costs. Disabled rows contribute nothing. */
export function summariseCosts(costs: CostResult[]): CostSummary {
  const byCategory: Record<string, number> = {}
  let total = 0

  for (const cost of costs) {
    if (!cost.enabled) continue
    total += cost.amount
    byCategory[cost.category] = (byCategory[cost.category] ?? 0) + cost.amount
  }

  return { total, byCategory, errors: costs.filter((cost) => cost.error !== undefined) }
}

export interface CashRequiredInput {
  /** Minor units. */
  purchasePrice: number
  /** Minor units. Total of the enabled upfront costs. */
  upfrontCosts: number
  /** Minor units. */
  loanAmount: number
}

export interface CashRequired {
  /** Minor units. Equivalent to the deposit, and never double counts it. */
  deposit: number
  /** Minor units. */
  upfrontCosts: number
  /** Minor units. Deposit plus upfront costs. */
  total: number
}

/**
 * Cash needed at settlement.
 *
 * `purchasePrice + upfrontCosts - loanAmount`. The deposit is *implied* by the
 * price and the loan, so it must not be added again: doing so is the easiest
 * mistake to make here and is covered by a test.
 */
export function cashRequired(input: CashRequiredInput): CashRequired {
  const deposit = input.purchasePrice - input.loanAmount
  return { deposit, upfrontCosts: input.upfrontCosts, total: deposit + input.upfrontCosts }
}

export interface CashPosition {
  /** Minor units. */
  availableFunds: number
  /** Minor units. */
  cashRequired: number
  /** Minor units. Negative means the purchase is short. */
  remaining: number
  shortfall: boolean
}

/** Available funds against cash required. */
export function cashPosition(availableFunds: number, required: number): CashPosition {
  const remaining = availableFunds - required
  return { availableFunds, cashRequired: required, remaining, shortfall: remaining < 0 }
}
