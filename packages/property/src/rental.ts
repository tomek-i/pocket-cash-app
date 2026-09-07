/**
 * Rental income, yields and cash flow.
 *
 * Two conventions worth stating, because both are reported inconsistently in the
 * wild and the UI has to be explicit about which it means:
 *
 * - **Net yield excludes financing.** It is net operating income over property
 *   value, so it describes the property rather than the loan against it.
 * - **Cash flow is reported twice**, before and after principal. Principal
 *   repayment is not an expense, it buys equity, but it does leave the bank
 *   account, so both numbers matter.
 */

import { normalise } from './recurrence'
import type { Frequency } from './types'

export interface RentalInput {
  /** Minor units, at `rentFrequency`. */
  rent: number
  rentFrequency: Frequency
  /** Times per year, when `rentFrequency` is `custom`. */
  rentCustomPerYear?: number
  /** Decimal share of the year the property sits empty. `0.02` is roughly one week. */
  vacancyRate?: number
  /** Decimal share of collected rent paid to a manager. `0.07` is 7%. */
  managementRate?: number
}

export interface PropertyCashFlowInput extends RentalInput {
  /** Minor units. Property value the yields are measured against. */
  propertyValue: number
  /** Minor units per year. Holding costs excluding the loan. */
  annualOperatingExpenses: number
  /** Minor units per year. Interest portion of the loan. */
  annualInterest: number
  /** Minor units per year. Principal portion of the loan. */
  annualPrincipal: number
}

export interface RentalSummary {
  /** Minor units per year, before any deduction. */
  grossAnnualRent: number
  /** Minor units per month. */
  grossMonthlyRent: number
  /** Minor units per year lost to vacancy. */
  vacancyLoss: number
  /** Minor units per year paid to a property manager. */
  managementFee: number
  /** Gross rent less vacancy and management, minor units per year. */
  effectiveAnnualRent: number
}

/** Rent after vacancy and management, with the deductions itemised. */
export function summariseRental(input: RentalInput): RentalSummary {
  const { annual: grossAnnualRent, monthly: grossMonthlyRent } = normalise({
    amount: input.rent,
    frequency: input.rentFrequency,
    customPerYear: input.rentCustomPerYear,
  })

  const vacancyLoss = Math.round(grossAnnualRent * (input.vacancyRate ?? 0))
  const collected = grossAnnualRent - vacancyLoss
  // Management is charged on rent actually collected, not on rent advertised.
  const managementFee = Math.round(collected * (input.managementRate ?? 0))

  return {
    grossAnnualRent,
    grossMonthlyRent,
    vacancyLoss,
    managementFee,
    effectiveAnnualRent: collected - managementFee,
  }
}

export interface PropertyCashFlow extends RentalSummary {
  /** Effective rent less operating expenses, minor units per year. Excludes the loan. */
  netOperatingIncome: number
  /** Gross rent over property value, decimal. */
  grossYield: number
  /** Net operating income over property value, decimal. */
  netYield: number
  /** Net operating income less interest, minor units per year. */
  annualCashFlowBeforePrincipal: number
  /** Net operating income less interest and principal, minor units per year. */
  annualCashFlow: number
  /** Annual cash flow over twelve, minor units. */
  monthlyCashFlow: number
  /** True when the property costs more to hold than it earns. */
  negative: boolean
}

/** The full picture: what the property earns, costs and leaves over. */
export function propertyCashFlow(input: PropertyCashFlowInput): PropertyCashFlow {
  const rental = summariseRental(input)

  const netOperatingIncome = rental.effectiveAnnualRent - input.annualOperatingExpenses
  const annualCashFlowBeforePrincipal = netOperatingIncome - input.annualInterest
  const annualCashFlow = annualCashFlowBeforePrincipal - input.annualPrincipal

  const value = input.propertyValue
  return {
    ...rental,
    netOperatingIncome,
    grossYield: value > 0 ? rental.grossAnnualRent / value : 0,
    netYield: value > 0 ? netOperatingIncome / value : 0,
    annualCashFlowBeforePrincipal,
    annualCashFlow,
    monthlyCashFlow: Math.round(annualCashFlow / 12),
    negative: annualCashFlow < 0,
  }
}
