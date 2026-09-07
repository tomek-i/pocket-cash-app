import type { CostType, RateScheduleRow, RateScheduleSnapshot } from '@repo/database'
import {
  type CalculationContext,
  type CostBasis,
  type CostDefinition,
  type CostResult,
  type CostState,
  calculateCost,
  cashRequired,
  type RateSchedule,
  summariseCosts,
} from '@repo/property'

/**
 * Turning stored cost rows into figures.
 *
 * The split the whole feature rests on lives here. A **cost type** is the
 * reusable definition ("Building Inspection, normally $600"); a **property cost**
 * is what one property says about it ("actually $750"). They are combined at read
 * time, so overriding a cost on one property never edits the definition every
 * other property uses.
 */

/** A `property_costs` row joined to the cost type it references. */
export interface PropertyCostRow {
  id: string
  costTypeId: string
  enabled: boolean
  manualValue: number | null
  overrideValue: number | null
  actualValue: number | null
  sortOrder: number
  costType: CostType
}

/** One evaluated row: the stored record, plus what it currently works out to. */
export interface EvaluatedCost {
  row: PropertyCostRow
  result: CostResult
}

export interface CostContextInput {
  /** Minor units. */
  purchasePrice: number
  /** Minor units. What LVR is measured against. */
  propertyValue: number
  /** Minor units. */
  loanAmount: number
  /** Decimal annual rate. */
  annualRate: number
}

/**
 * The variables costs are calculated from.
 *
 * `dutiableValue` is the purchase price. Some jurisdictions charge duty on the
 * greater of price and market value; that is a rule change rather than a code
 * change, so it belongs in a future rate schedule option, not baked in here.
 */
export function buildCostContext(input: CostContextInput): CalculationContext {
  const deposit = Math.max(0, input.purchasePrice - input.loanAmount)
  return {
    purchasePrice: input.purchasePrice,
    propertyValue: input.propertyValue,
    loanAmount: input.loanAmount,
    deposit,
    dutiableValue: input.purchasePrice,
    lvr: input.propertyValue > 0 ? input.loanAmount / input.propertyValue : 0,
    interestRate: input.annualRate,
  }
}

/**
 * A stored cost type as the engine's definition.
 *
 * The database records which *group* of schedule a bracketed cost needs
 * ("transfer-tax"), not a specific schedule, so that next year's rates are
 * picked up by date. The concrete schedule is resolved by the caller and passed
 * in here.
 */
export function toCostDefinition(
  costType: CostType,
  resolvedScheduleId: string | null,
): CostDefinition {
  return {
    id: costType.id,
    name: costType.name,
    category: costType.category,
    calculationType: costType.calculationType,
    defaultValue: costType.defaultValue ?? undefined,
    percentage: costType.percentage ?? undefined,
    calculationBase: costType.calculationBase ?? undefined,
    formula: costType.formula ?? undefined,
    rateScheduleId: resolvedScheduleId ?? undefined,
    currency: costType.currency ?? undefined,
    notes: costType.notes ?? undefined,
  }
}

/** A property cost row as the engine's per-property state. */
export function toCostState(row: PropertyCostRow): CostState {
  return {
    enabled: row.enabled,
    manualValue: row.manualValue,
    overrideValue: row.overrideValue,
    actualValue: row.actualValue,
  }
}

export interface EvaluateCostsInput {
  rows: PropertyCostRow[]
  context: CalculationContext
  /** Schedules available to bracketed costs, already resolved for the date. */
  schedules: RateSchedule[]
  /** Maps a schedule group to the schedule id in force. */
  scheduleIdByGroup: Record<string, string>
  basis?: CostBasis
}

/** Evaluate every cost on a property, in display order. */
export function evaluateCosts(input: EvaluateCostsInput): EvaluatedCost[] {
  return [...input.rows]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.costType.name.localeCompare(b.costType.name))
    .map((row) => {
      const group = row.costType.rateScheduleGroup
      const scheduleId = group ? (input.scheduleIdByGroup[group] ?? null) : null
      return {
        row,
        result: calculateCost(
          toCostDefinition(row.costType, scheduleId),
          toCostState(row),
          input.context,
          { schedules: input.schedules, basis: input.basis },
        ),
      }
    })
}

export interface UpfrontCostsSummary {
  costs: EvaluatedCost[]
  /** Minor units. Enabled costs only. */
  total: number
  /** Minor units, keyed by category. */
  byCategory: Record<string, number>
  /** Rows that could not be calculated, so the UI can surface them. */
  errors: CostResult[]
  /** Minor units. Deposit plus upfront costs. */
  cashRequired: number
  /** Minor units. Implied by the price and the loan, never added twice. */
  deposit: number
}

/** Costs, totals and the cash needed at settlement. */
export function summariseUpfrontCosts(input: EvaluateCostsInput): UpfrontCostsSummary {
  const costs = evaluateCosts(input)
  const summary = summariseCosts(costs.map((entry) => entry.result))
  const cash = cashRequired({
    purchasePrice: input.context.purchasePrice,
    upfrontCosts: summary.total,
    loanAmount: input.context.loanAmount,
  })

  return {
    costs,
    total: summary.total,
    byCategory: summary.byCategory,
    errors: summary.errors,
    cashRequired: cash.total,
    deposit: cash.deposit,
  }
}

/** A stored rate schedule row as the engine's `RateSchedule`. */
export function toEngineSchedule(
  row: RateScheduleRow,
  country: string,
  region: string | null,
): RateSchedule {
  return {
    id: row.id,
    name: row.name,
    jurisdiction: row.jurisdictionKey,
    country,
    region,
    currency: row.currency,
    effectiveFrom: row.effectiveFrom,
    effectiveTo: row.effectiveTo,
    calculationType: 'bracketed',
    version: row.version,
    enabled: row.enabled,
    brackets: row.brackets,
  }
}

/**
 * A frozen snapshot as the engine's `RateSchedule`.
 *
 * Used in place of the live schedule once a purchase is completed, so later
 * edits to the schedule cannot rewrite what the purchase already cost.
 */
export function snapshotToEngineSchedule(
  snapshot: RateScheduleSnapshot,
  jurisdictionKey: string,
  country: string,
  region: string | null,
): RateSchedule {
  return {
    id: snapshot.scheduleId,
    name: snapshot.name,
    jurisdiction: jurisdictionKey,
    country,
    region,
    currency: snapshot.currency,
    effectiveFrom: snapshot.effectiveFrom,
    effectiveTo: snapshot.effectiveTo,
    calculationType: 'bracketed',
    version: snapshot.version,
    enabled: true,
    brackets: snapshot.brackets,
  }
}
