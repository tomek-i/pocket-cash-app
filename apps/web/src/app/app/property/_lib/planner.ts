import {
  type AmortisationSummary,
  amortisationSummary,
  deriveFinancing,
  type Financing,
  type FinancingSource,
  type LoanTerms,
  type LoanType,
} from '@repo/property'

/**
 * The planner's financing derivation.
 *
 * A thin layer over `@repo/property` that decides two things the engine
 * deliberately leaves to the caller: which value LVR is measured against, and
 * which of deposit, deposit percentage and loan amount is the one the user
 * actually typed.
 */

export interface FinancingInputs {
  /** Minor units. */
  purchasePrice: number
  /** Minor units. What it would sell for today. `null` when not recorded. */
  marketValue: number | null
  /** Which field the user edited last. The other two are derived from it. */
  source: FinancingSource
  /** Minor units. Read when `source` is `deposit`. */
  deposit: number
  /** Decimal share. Read when `source` is `depositPercentage`. */
  depositPercentage: number
  /** Minor units. Read when `source` is `loanAmount`. */
  loanAmount: number
  /** Decimal annual rate. */
  annualRate: number
  termYears: number
  loanType: LoanType
  /** Minor units. Reduces the balance interest is charged on. */
  offsetBalance: number
}

export interface FinancingResult {
  /** Minor units. What LVR and equity are measured against. */
  propertyValue: number
  financing: Financing
  amortisation: AmortisationSummary
  /** The loan as the engine sees it, for the sensitivity table. */
  terms: LoanTerms
  /**
   * Minor units. The balance interest is actually charged on once an offset
   * account is taken into account. Never below zero.
   */
  effectiveLoanBalance: number
  /** Repayment on the offset-reduced balance, minor units. */
  offsetAdjustedMonthlyRepayment: number
}

/**
 * The value the property is measured by.
 *
 * What it is worth, falling back to what is being paid. Measuring LVR against
 * the market value rather than the purchase price is deliberate: buying under
 * valuation should show the better ratio it genuinely gives.
 */
export function plannerPropertyValue(input: {
  marketValue: number | null
  purchasePrice: number
}): number {
  return input.marketValue ?? input.purchasePrice
}

/** Everything the financing panel and the dashboard need. */
export function buildFinancing(input: FinancingInputs): FinancingResult {
  const propertyValue = plannerPropertyValue(input)

  const financing = deriveFinancing({
    purchasePrice: input.purchasePrice,
    propertyValue,
    source: input.source,
    deposit: input.deposit,
    depositPercentage: input.depositPercentage,
    loanAmount: input.loanAmount,
  })

  const terms: LoanTerms = {
    principal: financing.loanAmount,
    annualRate: input.annualRate,
    termYears: input.termYears,
    loanType: input.loanType,
  }

  // An offset account does not reduce the debt, it reduces the balance interest
  // is charged on. So LVR and equity stay based on the full loan, while the
  // repayment comparison uses the reduced balance.
  const effectiveLoanBalance = Math.max(0, financing.loanAmount - input.offsetBalance)
  const offsetTerms: LoanTerms = { ...terms, principal: effectiveLoanBalance }

  return {
    propertyValue,
    financing,
    amortisation: amortisationSummary(terms),
    terms,
    effectiveLoanBalance,
    offsetAdjustedMonthlyRepayment: amortisationSummary(offsetTerms).monthlyRepayment,
  }
}
