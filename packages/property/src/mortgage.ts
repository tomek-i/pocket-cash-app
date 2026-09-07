/**
 * Loan maths: repayments, amortisation, LVR and the deposit/loan relationship.
 *
 * Repayments are computed from an unrounded monthly payment and only rounded on
 * the way out. Rounding first and then amortising drifts by a few dollars over a
 * 30 year term and leaves a non-zero balance at the end, which looks like a bug.
 */

import type { LoanType } from './types'

/** Months in a year. Named because it appears in nearly every formula here. */
const MONTHS_PER_YEAR = 12

/**
 * The monthly payment for a principal and interest loan, unrounded.
 *
 * This is the standard amortisation formula, `PMT(rate/12, years*12, -principal)`.
 * A zero rate degenerates to straight line repayment, which the formula itself
 * cannot express because it divides by the rate.
 */
function exactMonthlyRepayment(annualRate: number, termYears: number, principal: number): number {
  const months = Math.round(termYears * MONTHS_PER_YEAR)
  if (months <= 0 || principal <= 0) return 0

  const monthlyRate = annualRate / MONTHS_PER_YEAR
  if (monthlyRate === 0) return principal / months

  const growth = (1 + monthlyRate) ** months
  return (principal * monthlyRate * growth) / (growth - 1)
}

/**
 * The monthly repayment in minor units.
 *
 * `loanType` matters: an interest only loan pays the interest and nothing else,
 * so the balance never moves.
 */
export function monthlyRepayment(
  annualRate: number,
  termYears: number,
  principal: number,
  loanType: LoanType = 'principalAndInterest',
): number {
  if (principal <= 0 || termYears <= 0) return 0
  if (loanType === 'interestOnly') {
    return Math.round((principal * annualRate) / MONTHS_PER_YEAR)
  }
  return Math.round(exactMonthlyRepayment(annualRate, termYears, principal))
}

export interface LoanTerms {
  /** Minor units. */
  principal: number
  /** Decimal annual rate, `0.062` is 6.2%. */
  annualRate: number
  termYears: number
  loanType: LoanType
}

/**
 * The balance left after `months` of repayments, minor units.
 *
 * Never negative, and never past the end of the term: asking for the balance
 * after 10 years on a 5 year loan gives 0 rather than a nonsense number.
 */
export function balanceAfterMonths(terms: LoanTerms, months: number): number {
  const { principal, annualRate, termYears, loanType } = terms
  if (principal <= 0 || months <= 0) return Math.max(0, principal)

  const totalMonths = Math.round(termYears * MONTHS_PER_YEAR)
  if (months >= totalMonths) return loanType === 'interestOnly' ? principal : 0
  if (loanType === 'interestOnly') return principal

  const monthlyRate = annualRate / MONTHS_PER_YEAR
  const payment = exactMonthlyRepayment(annualRate, termYears, principal)

  if (monthlyRate === 0) return Math.max(0, Math.round(principal - payment * months))

  const growth = (1 + monthlyRate) ** months
  const balance = principal * growth - payment * ((growth - 1) / monthlyRate)
  return Math.max(0, Math.round(balance))
}

export interface AmortisationSummary {
  /** Minor units. */
  monthlyRepayment: number
  /** Minor units. */
  annualRepayment: number
  /** Total interest over the whole term, minor units. */
  totalInterest: number
  /** Principal repaid during the first 12 months, minor units. */
  principalYear1: number
  /** Interest paid during the first 12 months, minor units. */
  interestYear1: number
  /** Balance after 12 months, minor units. */
  balanceAfter1Year: number
  /** Balance after 60 months, minor units. */
  balanceAfter5Years: number
  /** Balance after 120 months, minor units. */
  balanceAfter10Years: number
}

/** Everything the financing panel shows about a loan. */
export function amortisationSummary(terms: LoanTerms): AmortisationSummary {
  const { principal, annualRate, termYears, loanType } = terms

  if (principal <= 0 || termYears <= 0) {
    return {
      monthlyRepayment: 0,
      annualRepayment: 0,
      totalInterest: 0,
      principalYear1: 0,
      interestYear1: 0,
      balanceAfter1Year: Math.max(0, principal),
      balanceAfter5Years: Math.max(0, principal),
      balanceAfter10Years: Math.max(0, principal),
    }
  }

  const totalMonths = Math.round(termYears * MONTHS_PER_YEAR)
  const monthsInYear1 = Math.min(MONTHS_PER_YEAR, totalMonths)

  const exactPayment =
    loanType === 'interestOnly'
      ? (principal * annualRate) / MONTHS_PER_YEAR
      : exactMonthlyRepayment(annualRate, termYears, principal)

  // Every figure the user is shown is derived from the *rounded* payment, which
  // is the one they actually pay. Deriving the annual and total figures from the
  // unrounded payment instead leaves the summary disagreeing with itself by a
  // few cents, which reads as a bug. Balances still use the exact payment, so
  // the loan clears at the end of the term rather than drifting.
  const payment = Math.round(exactPayment)

  const balanceAfter1Year = balanceAfterMonths(terms, MONTHS_PER_YEAR)
  const principalYear1 = principal - balanceAfter1Year
  const interestYear1 = payment * monthsInYear1 - principalYear1

  const totalInterest =
    loanType === 'interestOnly' ? payment * totalMonths : payment * totalMonths - principal

  return {
    monthlyRepayment: payment,
    annualRepayment: payment * MONTHS_PER_YEAR,
    totalInterest,
    principalYear1,
    interestYear1,
    balanceAfter1Year,
    balanceAfter5Years: balanceAfterMonths(terms, 5 * MONTHS_PER_YEAR),
    balanceAfter10Years: balanceAfterMonths(terms, 10 * MONTHS_PER_YEAR),
  }
}

/**
 * Loan to value ratio as a decimal, `0.8` being 80%.
 *
 * Deliberately calculated against the property value rather than the purchase
 * price: buying under valuation should show the better LVR it actually gives.
 * Returns 0 when there is no value to divide by, since an undefined ratio is
 * more misleading in a summary card than a zero.
 */
export function lvr(loanAmount: number, propertyValue: number): number {
  if (propertyValue <= 0) return 0
  return loanAmount / propertyValue
}

/** Equity in a property, minor units. Can be negative when the loan is underwater. */
export function equity(propertyValue: number, loanBalance: number): number {
  return propertyValue - loanBalance
}

/** Which figure the user typed, so the other two can be derived from it. */
export type FinancingSource = 'deposit' | 'depositPercentage' | 'loanAmount'

export interface FinancingInput {
  /** Minor units. */
  purchasePrice: number
  /** Minor units. Falls back to the purchase price when not separately estimated. */
  propertyValue?: number
  source: FinancingSource
  /** Minor units. Read when `source` is `deposit`. */
  deposit?: number
  /** Decimal, `0.2` is 20%. Read when `source` is `depositPercentage`. */
  depositPercentage?: number
  /** Minor units. Read when `source` is `loanAmount`. */
  loanAmount?: number
}

export interface Financing {
  purchasePrice: number
  propertyValue: number
  /** Minor units. */
  deposit: number
  /** Decimal share of the purchase price. */
  depositPercentage: number
  /** Minor units. Never negative. */
  loanAmount: number
  /** Decimal ratio against the property value. */
  lvr: number
  /** True when the deposit is larger than the purchase price. */
  depositExceedsPrice: boolean
}

/**
 * Resolve deposit, deposit percentage and loan amount from whichever one the
 * user entered. Only the field named by `source` is read, so the two derived
 * fields cannot fight the one being typed into.
 */
export function deriveFinancing(input: FinancingInput): Financing {
  const purchasePrice = Math.max(0, input.purchasePrice)
  const propertyValue = input.propertyValue ?? purchasePrice

  let deposit: number
  switch (input.source) {
    case 'depositPercentage':
      deposit = Math.round(purchasePrice * (input.depositPercentage ?? 0))
      break
    case 'loanAmount':
      deposit = purchasePrice - Math.max(0, input.loanAmount ?? 0)
      break
    default:
      deposit = input.deposit ?? 0
  }

  const depositExceedsPrice = deposit > purchasePrice
  const loanAmount = Math.max(0, purchasePrice - deposit)

  return {
    purchasePrice,
    propertyValue,
    deposit,
    depositPercentage: purchasePrice > 0 ? deposit / purchasePrice : 0,
    loanAmount,
    lvr: lvr(loanAmount, propertyValue),
    depositExceedsPrice,
  }
}

export interface SensitivityRow {
  /** Decimal annual rate. */
  annualRate: number
  /** Minor units. */
  monthlyRepayment: number
  /** Minor units. */
  annualRepayment: number
  /** Difference in monthly repayment against the loan's actual rate, minor units. */
  monthlyDifference: number
}

/**
 * Repayments across a set of rates, for the "what if rates move" table. The rate
 * list is configuration, not a constant, so nothing here assumes 4% to 8%.
 */
export function sensitivity(rates: number[], terms: LoanTerms): SensitivityRow[] {
  const baseline = monthlyRepayment(
    terms.annualRate,
    terms.termYears,
    terms.principal,
    terms.loanType,
  )

  return rates.map((annualRate) => {
    const monthly = monthlyRepayment(annualRate, terms.termYears, terms.principal, terms.loanType)
    return {
      annualRate,
      monthlyRepayment: monthly,
      annualRepayment: monthly * MONTHS_PER_YEAR,
      monthlyDifference: monthly - baseline,
    }
  })
}
