/**
 * Defaults applied to a new property, and the rate list the sensitivity table
 * uses. All of it is editable in Settings > Property > Calculation Settings, so
 * these are starting values rather than constants the engine relies on.
 */

export interface PropertyCalculationSettings {
  /** Years. */
  defaultLoanTermYears: number
  /** Decimal annual rate. */
  defaultInterestRate: number
  /** Decimal share of the purchase price. */
  defaultDepositPercentage: number
  /** Decimal share of the year a rental sits empty. */
  defaultVacancyRate: number
  /** Decimal share of collected rent paid to a manager. */
  defaultManagementRate: number
  /** Decimal annual rates shown in the interest rate sensitivity table. */
  sensitivityRates: number[]
}

export const DEFAULT_CALCULATION_SETTINGS: PropertyCalculationSettings = {
  defaultLoanTermYears: 30,
  defaultInterestRate: 0.06,
  defaultDepositPercentage: 0.2,
  defaultVacancyRate: 0.02,
  defaultManagementRate: 0.07,
  sensitivityRates: [0.04, 0.05, 0.06, 0.07, 0.08],
}
