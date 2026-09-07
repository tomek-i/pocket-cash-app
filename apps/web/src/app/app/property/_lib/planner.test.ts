import { describe, expect, it } from 'vitest'
import { buildFinancing, type FinancingInputs, plannerPropertyValue } from './planner'

function inputs(overrides: Partial<FinancingInputs> = {}): FinancingInputs {
  return {
    purchasePrice: 1_000_000_00,
    estimatedMarketValue: null,
    currentValue: null,
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
  it('prefers the current value, then the estimate, then the price paid', () => {
    expect(
      plannerPropertyValue({
        currentValue: 1_200_000_00,
        estimatedMarketValue: 1_100_000_00,
        purchasePrice: 1_000_000_00,
      }),
    ).toBe(1_200_000_00)
    expect(
      plannerPropertyValue({
        currentValue: null,
        estimatedMarketValue: 1_100_000_00,
        purchasePrice: 1_000_000_00,
      }),
    ).toBe(1_100_000_00)
    expect(
      plannerPropertyValue({
        currentValue: null,
        estimatedMarketValue: null,
        purchasePrice: 1_000_000_00,
      }),
    ).toBe(1_000_000_00)
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
    const result = buildFinancing(inputs({ estimatedMarketValue: 1_100_000_00 }))
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
