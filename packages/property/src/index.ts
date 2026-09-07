/**
 * `@repo/property`: the property and loan calculation engine.
 *
 * Pure functions over plain data. No database, no React, no I/O, no clock
 * beyond an injectable "today". Everything jurisdiction specific lives in
 * `./defaults` as data and is imported from there, never from here.
 */

export {
  applyBracket,
  type BracketBreakdown,
  calculateBracketed,
  isEffectiveOn,
  resolveBracket,
  type SelectScheduleOptions,
  selectSchedule,
} from './brackets'
export {
  type CashPosition,
  type CashRequired,
  type CashRequiredInput,
  type CostBasis,
  type CostBreakdown,
  type CostDefinition,
  type CostEvaluationOptions,
  type CostResult,
  type CostState,
  type CostSummary,
  calculateCost,
  cashPosition,
  cashRequired,
  resolveBase,
  summariseCosts,
} from './cost'
export {
  evaluateFormula,
  FORMULA_FUNCTIONS,
  FORMULA_VARIABLES,
  type FormulaVariable,
  validateFormula,
} from './formula'
export {
  type AmortisationSummary,
  amortisationSummary,
  balanceAfterMonths,
  deriveFinancing,
  equity,
  type Financing,
  type FinancingInput,
  type FinancingSource,
  type LoanTerms,
  lvr,
  monthlyRepayment,
  type SensitivityRow,
  sensitivity,
} from './mortgage'
export {
  convertFrequency,
  type NormalisedAmount,
  normalise,
  normaliseTotal,
  occurrencesPerYear,
  type RecurringAmount,
} from './recurrence'
export {
  type PropertyCashFlow,
  type PropertyCashFlowInput,
  propertyCashFlow,
  type RentalInput,
  type RentalSummary,
  summariseRental,
} from './rental'
export {
  type CalculationBase,
  type CalculationContext,
  type CalculationType,
  type EngineError,
  type EngineResult,
  type Frequency,
  fail,
  type LoanType,
  ok,
  type RateBracket,
  type RateSchedule,
  type RateUnit,
} from './types'
export {
  type BoundaryProbe,
  probeRateSchedule,
  type ValidationIssue,
  type ValidationResult,
  type ValidationSeverity,
  validateRateSchedule,
  validateScheduleSet,
} from './validate'
