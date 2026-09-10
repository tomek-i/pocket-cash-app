import { describe, expect, it } from 'vitest'
import { buildFinancing, type FinancingInputs, plannerPropertyValue } from './planner'

function inputs(overrides: Partial<FinancingInputs> = {}): FinancingInputs {
  return {
    purchasePrice: 1_000_000_00,
    marketValue: null,
    source: 'deposit',
    deposit: 200_000_00,
    depositPercentage: 0.2,
    loanAmount: 800_000_00,
    annualRate: 0.06,
    termYears: 30,
    loanType: 'principalAndInterest',
    offsetBalance: 0,
    ...overrides,
  }
}

describe('plannerPropertyValue', () => {
  it('measures by what it is worth', () => {
    expect(plannerPropertyValue({ marketValue: 1_100_000_00, purchasePrice: 1_000_000_00 })).toBe(
      1_100_000_00,
    )
  })

  it('falls back to the price when no value is recorded', () => {
    expect(plannerPropertyValue({ marketValue: null, purchasePrice: 1_000_000_00 })).toBe(
      1_000_000_00,
    )
  })

  it('treats a zero value as recorded, not as missing', () => {
    // A property genuinely worth nothing is a real, if grim, position. Falling
    // back to the price there would quietly report the wrong LVR.
    expect(plannerPropertyValue({ marketValue: 0, purchasePrice: 1_000_000_00 })).toBe(0)
  })
})

describe('buildFinancing', () => {
  it('derives the loan from a deposit', () => {
    const result = buildFinancing(inputs())
    expect(result.financing.loanAmount).toBe(800_000_00)
    expect(result.financing.lvr).toBe(0.8)
  })

  it('derives the deposit from a loan amount', () => {
    const result = buildFinancing(inputs({ source: 'loanAmount', loanAmount: 750_000_00 }))
    expect(result.financing.deposit).toBe(250_000_00)
  })

  it('derives both from a deposit percentage', () => {
    const result = buildFinancing(inputs({ source: 'depositPercentage', depositPercentage: 0.15 }))
    expect(result.financing.deposit).toBe(150_000_00)
    expect(result.financing.loanAmount).toBe(850_000_00)
  })

  it('reads only the field the user last edited, so the inputs cannot fight', () => {
    // Deposit says 20%, loan amount says something else. Source decides.
    const byDeposit = buildFinancing(inputs({ source: 'deposit', loanAmount: 1_00 }))
    expect(byDeposit.financing.loanAmount).toBe(800_000_00)

    const byLoan = buildFinancing(inputs({ source: 'loanAmount', loanAmount: 600_000_00 }))
    expect(byLoan.financing.deposit).toBe(400_000_00)
  })

  it('measures LVR against the market value, so buying under valuation shows the better ratio', () => {
    const result = buildFinancing(inputs({ marketValue: 1_100_000_00 }))
    expect(result.propertyValue).toBe(1_100_000_00)
    expect(result.financing.lvr).toBeCloseTo(0.727, 3)
  })

  it('reports the repayment and the year 1 split', () => {
    const result = buildFinancing(inputs())
    expect(result.amortisation.monthlyRepayment / 100).toBeCloseTo(4796.4, 0)
    expect(result.amortisation.principalYear1 + result.amortisation.interestYear1).toBe(
      result.amortisation.annualRepayment,
    )
  })

  it('reports balances that fall over time', () => {
    const { amortisation } = buildFinancing(inputs())
    expect(amortisation.balanceAfter1Year).toBeGreaterThan(amortisation.balanceAfter5Years)
    expect(amortisation.balanceAfter5Years).toBeGreaterThan(amortisation.balanceAfter10Years)
  })

  it('charges interest only, leaving the balance alone', () => {
    const result = buildFinancing(inputs({ loanType: 'interestOnly' }))
    expect(result.amortisation.monthlyRepayment).toBe(4_000_00)
    expect(result.amortisation.principalYear1).toBe(0)
    expect(result.amortisation.balanceAfter10Years).toBe(800_000_00)
  })

  describe('offset account', () => {
    it('lowers the repayment without lowering the debt', () => {
      const result = buildFinancing(inputs({ offsetBalance: 100_000_00 }))
      // The debt, and so the LVR, is unchanged.
      expect(result.financing.loanAmount).toBe(800_000_00)
      expect(result.financing.lvr).toBe(0.8)
      // Only the balance interest is charged on moves.
      expect(result.effectiveLoanBalance).toBe(700_000_00)
      expect(result.offsetAdjustedMonthlyRepayment).toBeLessThan(
        result.amortisation.monthlyRepayment,
      )
    })

    it('never takes the offset balance below zero', () => {
      const result = buildFinancing(inputs({ offsetBalance: 900_000_00 }))
      expect(result.effectiveLoanBalance).toBe(0)
      expect(result.offsetAdjustedMonthlyRepayment).toBe(0)
    })

    it('changes nothing when there is no offset', () => {
      const result = buildFinancing(inputs())
      expect(result.effectiveLoanBalance).toBe(800_000_00)
      expect(result.offsetAdjustedMonthlyRepayment).toBe(result.amortisation.monthlyRepayment)
    })
  })

  it('handles a cash purchase with no loan', () => {
    const result = buildFinancing(inputs({ source: 'loanAmount', loanAmount: 0 }))
    expect(result.financing.deposit).toBe(1_000_000_00)
    expect(result.financing.lvr).toBe(0)
    expect(result.amortisation.monthlyRepayment).toBe(0)
  })

  it('flags a deposit above the purchase price rather than showing a negative loan', () => {
    const result = buildFinancing(inputs({ deposit: 1_200_000_00 }))
    expect(result.financing.depositExceedsPrice).toBe(true)
    expect(result.financing.loanAmount).toBe(0)
  })
})

/**
 * The regression for #99.
 *
 * A property owned for a while can carry a loan bigger than the price recorded
 * against it: the price is historic, and the loan has been drawn against what it
 * is worth now. Deriving from the deposit clamped that to zero and then handed
 * back the purchase price as the loan, so the planner and the portfolio reported
 * different LVRs for one property.
 */
describe('a loan larger than the purchase price', () => {
  const owned = {
    purchasePrice: 450_000_00,
    marketValue: 900_000_00,
    loanAmount: 640_000_00,
    annualRate: 0.06,
    termYears: 30,
    loanType: 'principalAndInterest' as const,
    offsetBalance: 0,
    depositPercentage: 0,
    deposit: 0,
  }

  it('keeps the real loan when it is the field derived from', () => {
    const result = buildFinancing({ ...owned, source: 'loanAmount' })

    expect(result.financing.loanAmount).toBe(640_000_00)
    // Against the market value, matching what the portfolio card reports.
    expect(result.financing.lvr).toBeCloseTo(0.7111, 4)
  })

  it('reports the overshoot as a negative deposit rather than hiding it', () => {
    const result = buildFinancing({ ...owned, source: 'loanAmount' })
    expect(result.financing.deposit).toBe(-190_000_00)
  })

  it('is the figure the old deposit-derived path threw away', () => {
    // What the planner used to show: deposit clamped to 0, loan recomputed as
    // the whole purchase price, LVR half of the truth.
    const asBefore = buildFinancing({ ...owned, source: 'deposit', deposit: 0 })
    expect(asBefore.financing.loanAmount).toBe(450_000_00)
    expect(asBefore.financing.lvr).toBeCloseTo(0.5, 4)
  })
})
