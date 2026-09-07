import type { Frequency } from '@repo/property'
import {
  normalise,
  normaliseTotal,
  type PropertyCashFlow,
  propertyCashFlow,
  type RecurringAmount,
} from '@repo/property'

/**
 * What a property costs to hold, and what it earns.
 *
 * Two conventions the UI has to be explicit about, because both are reported
 * inconsistently in the wild:
 *
 * - **Cash flow is shown before and after principal.** Principal repayment is
 *   not an expense, it buys equity, but it does leave the bank account. Both
 *   figures matter and they are labelled separately.
 * - **Year 1 interest is used**, not an average. Interest falls over the life of
 *   a loan, so the first year is the worst case and the one worth planning
 *   against.
 */

/** A `property_recurring_costs` row, reduced to what the maths needs. */
export interface RecurringCostRow {
  id: string
  name: string
  category: string
  /** Minor units, charged at `frequency`. */
  amount: number
  frequency: Frequency
  /** Times per year, when `frequency` is `custom`. */
  customPerYear: number | null
  enabled: boolean
}

export interface NormalisedRecurringCost {
  row: RecurringCostRow
  /** Minor units per month. */
  monthly: number
  /** Minor units per year. */
  annual: number
}

function toRecurringAmount(row: RecurringCostRow): RecurringAmount {
  return {
    amount: row.amount,
    frequency: row.frequency,
    customPerYear: row.customPerYear ?? undefined,
  }
}

/** Each cost as monthly and annual figures. */
export function normaliseRecurringCosts(rows: RecurringCostRow[]): NormalisedRecurringCost[] {
  return rows.map((row) => ({ row, ...normalise(toRecurringAmount(row)) }))
}

export interface RecurringCostsSummary {
  costs: NormalisedRecurringCost[]
  /** Minor units per month. Enabled costs only. */
  monthly: number
  /** Minor units per year. Enabled costs only. */
  annual: number
  /** Minor units per year, keyed by category. */
  byCategory: Record<string, number>
}

/** Holding costs, totalled. Disabled rows contribute nothing. */
export function summariseRecurringCosts(rows: RecurringCostRow[]): RecurringCostsSummary {
  const costs = normaliseRecurringCosts(rows)
  const enabled = costs.filter((cost) => cost.row.enabled)
  const totals = normaliseTotal(enabled.map((cost) => toRecurringAmount(cost.row)))

  const byCategory: Record<string, number> = {}
  for (const cost of enabled) {
    byCategory[cost.row.category] = (byCategory[cost.row.category] ?? 0) + cost.annual
  }

  return { costs, monthly: totals.monthly, annual: totals.annual, byCategory }
}

export interface RentalInputRow {
  /** Minor units, at `rentFrequency`. */
  rent: number
  rentFrequency: Frequency
  rentCustomPerYear: number | null
  /** Decimal share of the year empty. */
  vacancyRate: number
  /** Decimal share of collected rent paid to a manager. */
  managementRate: number
}

export interface OngoingSummary {
  recurring: RecurringCostsSummary
  /** Null when the property is not let. */
  cashFlow: PropertyCashFlow | null
  /** Minor units per month. Holding costs plus the loan repayment. */
  monthlyOutgoings: number
}

export interface BuildOngoingInput {
  rows: RecurringCostRow[]
  rental: RentalInputRow | null
  /** Minor units. What yields are measured against. */
  propertyValue: number
  /** Minor units per year, first year of the loan. */
  annualInterest: number
  /** Minor units per year, first year of the loan. */
  annualPrincipal: number
  /** Minor units per month. */
  monthlyRepayment: number
}

/** Holding costs, rental income and the resulting cash flow. */
export function buildOngoing(input: BuildOngoingInput): OngoingSummary {
  const recurring = summariseRecurringCosts(input.rows)

  const cashFlow = input.rental
    ? propertyCashFlow({
        rent: input.rental.rent,
        rentFrequency: input.rental.rentFrequency,
        rentCustomPerYear: input.rental.rentCustomPerYear ?? undefined,
        vacancyRate: input.rental.vacancyRate,
        managementRate: input.rental.managementRate,
        propertyValue: input.propertyValue,
        annualOperatingExpenses: recurring.annual,
        annualInterest: input.annualInterest,
        annualPrincipal: input.annualPrincipal,
      })
    : null

  return {
    recurring,
    cashFlow,
    monthlyOutgoings: recurring.monthly + input.monthlyRepayment,
  }
}
