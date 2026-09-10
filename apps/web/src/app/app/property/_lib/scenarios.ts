import type { ScenarioOverrides } from '@repo/database'
import type { FinancingSource, LoanType, RateSchedule } from '@repo/property'
import { buildCostContext, type PropertyCostRow, summariseUpfrontCosts } from './costs'
import { type AvailableFundRow, summariseFunds } from './funds'
import { buildOngoing, type RecurringCostRow, type RentalInputRow } from './ongoing'
import { buildFinancing } from './planner'

/**
 * Scenarios: the same property at a different price, deposit or rate.
 *
 * A scenario is an **override set over the current working inputs**, never a
 * copy. Two consequences, both deliberate:
 *
 * - Editing the base property flows into every scenario, so a corrected rate or
 *   a newly added cost does not have to be applied five times over.
 * - The comparison is live like the rest of the planner. Nudge the base price and
 *   every column moves with it, which keeps the *differences* between scenarios
 *   the thing being read rather than the absolute figures.
 */

/** The working inputs a scenario starts from, in engine units. */
export interface ScenarioBase {
  /** Minor units. */
  purchasePrice: number
  /** Minor units. */
  estimatedMarketValue: number | null
  /** Minor units. */
  currentValue: number | null
  /** Which of the three financing fields the others are derived from. */
  source: FinancingSource
  /** Minor units. */
  deposit: number
  /** Decimal share of the purchase price. */
  depositPercentage: number
  /** Minor units. */
  loanAmount: number
  /** Decimal annual rate. */
  annualRate: number
  termYears: number
  loanType: LoanType
  /** Minor units. */
  offsetBalance: number
}

/** Everything shared across scenarios: the costs, the holding costs, the funds. */
export interface ScenarioContext {
  costRows: PropertyCostRow[]
  schedules: RateSchedule[]
  scheduleIdByGroup: Record<string, string>
  recurringRows: RecurringCostRow[]
  /** Null when the property is not let. */
  rental: RentalInputRow | null
  funds: AvailableFundRow[]
}

export interface ScenarioResult {
  /** Minor units. */
  purchasePrice: number
  /** Minor units. */
  deposit: number
  /** Decimal share of the purchase price. */
  depositPercentage: number
  /** Minor units. */
  loanAmount: number
  /** Decimal ratio. */
  lvr: number
  /** Minor units. */
  upfrontCosts: number
  /** Minor units. Deposit plus upfront costs. */
  cashRequired: number
  /** Minor units per month. */
  monthlyRepayment: number
  /** Minor units per year. */
  annualRepayment: number
  /** Minor units per month, excluding the loan. */
  monthlyPropertyCosts: number
  /** Minor units per month, after vacancy and management. Null when not let. */
  monthlyRentalIncome: number | null
  /** Minor units per month, after everything including principal. Null when not let. */
  monthlyCashFlow: number | null
  /** Minor units. Negative means the purchase is short. */
  remainingCash: number
  /** True when the recorded funds do not cover the cash required. */
  shortfall: boolean
}

/**
 * Fold a scenario's overrides onto the base.
 *
 * Overriding deposit, deposit percentage or loan amount also decides which of
 * the three the other two are derived from. Without moving `source` the override
 * would be stored and then ignored, because `deriveFinancing` reads only the
 * field `source` names. The order below is the precedence when a scenario
 * somehow carries more than one: the most specific figure wins.
 */
export function applyOverrides(base: ScenarioBase, overrides: ScenarioOverrides): ScenarioBase {
  const next: ScenarioBase = { ...base }

  if (overrides.purchasePrice !== undefined) next.purchasePrice = overrides.purchasePrice
  if (overrides.estimatedMarketValue !== undefined) {
    next.estimatedMarketValue = overrides.estimatedMarketValue
  }
  if (overrides.annualRate !== undefined) next.annualRate = overrides.annualRate
  if (overrides.termYears !== undefined) next.termYears = overrides.termYears

  if (overrides.loanAmount !== undefined) {
    next.loanAmount = overrides.loanAmount
    next.source = 'loanAmount'
  } else if (overrides.deposit !== undefined) {
    next.deposit = overrides.deposit
    next.source = 'deposit'
  } else if (overrides.depositPercentage !== undefined) {
    next.depositPercentage = overrides.depositPercentage
    next.source = 'depositPercentage'
  }

  return next
}

/**
 * Run one scenario through the whole planner.
 *
 * Every step is the same function the live panels use, called with a different
 * input set. That is the entire point of the design: a scenario cannot drift
 * from the planner, because there is no second implementation to drift from.
 */
export function evaluateScenario(
  base: ScenarioBase,
  overrides: ScenarioOverrides,
  context: ScenarioContext,
): ScenarioResult {
  const input = applyOverrides(base, overrides)

  const { financing, amortisation, propertyValue } = buildFinancing({
    purchasePrice: input.purchasePrice,
    estimatedMarketValue: input.estimatedMarketValue,
    currentValue: input.currentValue,
    source: input.source,
    deposit: input.deposit,
    depositPercentage: input.depositPercentage,
    loanAmount: input.loanAmount,
    annualRate: input.annualRate,
    termYears: input.termYears,
    loanType: input.loanType,
    offsetBalance: input.offsetBalance,
  })

  // Costs recalculate rather than carry over, because most of them are a
  // function of the price or the loan. Stamp duty at $1.05m is not stamp duty at
  // $1.1m, and a scenario that reused the base figure would be quietly wrong by
  // thousands.
  const costs = summariseUpfrontCosts({
    rows: context.costRows,
    context: buildCostContext({
      purchasePrice: financing.purchasePrice,
      propertyValue,
      loanAmount: financing.loanAmount,
      annualRate: input.annualRate,
    }),
    schedules: context.schedules,
    scheduleIdByGroup: context.scheduleIdByGroup,
  })

  const rental =
    context.rental && overrides.rent !== undefined
      ? { ...context.rental, rent: overrides.rent }
      : context.rental

  const ongoing = buildOngoing({
    rows: context.recurringRows,
    rental,
    propertyValue,
    annualInterest: amortisation.interestYear1,
    annualPrincipal: amortisation.principalYear1,
    monthlyRepayment: amortisation.monthlyRepayment,
  })

  const funds = summariseFunds(context.funds, costs.cashRequired)

  return {
    purchasePrice: financing.purchasePrice,
    deposit: financing.deposit,
    depositPercentage: financing.depositPercentage,
    loanAmount: financing.loanAmount,
    lvr: financing.lvr,
    upfrontCosts: costs.total,
    cashRequired: costs.cashRequired,
    monthlyRepayment: amortisation.monthlyRepayment,
    annualRepayment: amortisation.annualRepayment,
    monthlyPropertyCosts: ongoing.recurring.monthly,
    monthlyRentalIncome: ongoing.cashFlow
      ? Math.round(ongoing.cashFlow.effectiveAnnualRent / 12)
      : null,
    monthlyCashFlow: ongoing.cashFlow?.monthlyCashFlow ?? null,
    remainingCash: funds.position.remaining,
    shortfall: funds.position.shortfall,
  }
}

/** True when a scenario changes nothing, so the UI can say so instead of showing zeros. */
export function isEmptyOverrides(overrides: ScenarioOverrides): boolean {
  return Object.values(overrides).every((value) => value === undefined)
}
