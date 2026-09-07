/**
 * Loan maths, checked against amortisation figures that can be verified against
 * any published mortgage table: $800,000 at 6% over 30 years repays $4,796.40 a
 * month, and $500,000 at 5% over 30 years repays $2,684.11.
 */

import { describe, expect, it } from 'vitest'
import {
  amortisationSummary,
  balanceAfterMonths,
  deriveFinancing,
  equity,
  type LoanTerms,
  lvr,
  monthlyRepayment,
  sensitivity,
} from './mortgage'

const standard: LoanTerms = {
  principal: 800_000_00,
  annualRate: 0.06,
  termYears: 30,
  loanType: 'principalAndInterest',
}

describe('monthlyRepayment', () => {
  it('matches the published figure for $800,000 at 6% over 30 years', () => {
    expect(monthlyRepayment(0.06, 30, 800_000_00) / 100).toBeCloseTo(4796.4, 0)
  })

  it('matches the published figure for $500,000 at 5% over 30 years', () => {
    expect(monthlyRepayment(0.05, 30, 500_000_00) / 100).toBeCloseTo(2684.11, 0)
  })

  it('repays a 0% loan in equal straight-line instalments', () => {
    expect(monthlyRepayment(0, 10, 120_000_00)).toBe(1_000_00)
  })

  it('charges only interest on an interest-only loan', () => {
    expect(monthlyRepayment(0.06, 30, 800_000_00, 'interestOnly')).toBe(4_000_00)
  })

  it('returns zero for a zero principal or term', () => {
    expect(monthlyRepayment(0.06, 30, 0)).toBe(0)
    expect(monthlyRepayment(0.06, 0, 800_000_00)).toBe(0)
  })
})

describe('balanceAfterMonths', () => {
  it('clears the loan exactly at the end of the term', () => {
    expect(balanceAfterMonths(standard, 360)).toBe(0)
  })

  it('returns zero past the end of the term rather than a negative balance', () => {
    expect(balanceAfterMonths(standard, 480)).toBe(0)
  })

  it('returns the full principal before any repayment', () => {
    expect(balanceAfterMonths(standard, 0)).toBe(800_000_00)
  })

  it('reduces a 0% loan in equal steps', () => {
    const interestFree: LoanTerms = {
      principal: 120_000_00,
      annualRate: 0,
      termYears: 10,
      loanType: 'principalAndInterest',
    }
    expect(balanceAfterMonths(interestFree, 12)).toBe(108_000_00)
    expect(balanceAfterMonths(interestFree, 60)).toBe(60_000_00)
  })

  it('never moves the balance on an interest-only loan', () => {
    const io: LoanTerms = { ...standard, loanType: 'interestOnly' }
    expect(balanceAfterMonths(io, 12)).toBe(800_000_00)
    expect(balanceAfterMonths(io, 120)).toBe(800_000_00)
  })
})

describe('amortisationSummary', () => {
  const summary = amortisationSummary(standard)

  it('reports the annual repayment as twelve monthly ones', () => {
    expect(summary.annualRepayment).toBe(summary.monthlyRepayment * 12)
  })

  it('splits year 1 into principal and interest that add up', () => {
    expect(summary.principalYear1 + summary.interestYear1).toBe(summary.annualRepayment)
  })

  it('leaves a year 1 balance equal to the principal less what was repaid', () => {
    expect(summary.balanceAfter1Year).toBe(800_000_00 - summary.principalYear1)
  })

  it('pays mostly interest in the first year of a 30 year loan', () => {
    expect(summary.interestYear1).toBeGreaterThan(summary.principalYear1 * 4)
  })

  it('reduces the balance over time', () => {
    expect(summary.balanceAfter1Year).toBeGreaterThan(summary.balanceAfter5Years)
    expect(summary.balanceAfter5Years).toBeGreaterThan(summary.balanceAfter10Years)
  })

  it('reports total interest as total repayments less the principal', () => {
    expect(summary.totalInterest).toBe(summary.monthlyRepayment * 360 - 800_000_00)
  })

  it('charges no interest on a 0% loan', () => {
    const result = amortisationSummary({
      principal: 120_000_00,
      annualRate: 0,
      termYears: 10,
      loanType: 'principalAndInterest',
    })
    expect(result.totalInterest).toBe(0)
    expect(result.principalYear1).toBe(12_000_00)
    expect(result.interestYear1).toBe(0)
  })

  it('repays no principal on an interest-only loan', () => {
    const result = amortisationSummary({ ...standard, loanType: 'interestOnly' })
    expect(result.principalYear1).toBe(0)
    expect(result.interestYear1).toBe(48_000_00)
    expect(result.totalInterest).toBe(1_440_000_00)
    expect(result.balanceAfter10Years).toBe(800_000_00)
  })

  it('handles a zero principal without dividing by zero', () => {
    const result = amortisationSummary({ ...standard, principal: 0 })
    expect(result.monthlyRepayment).toBe(0)
    expect(result.totalInterest).toBe(0)
  })
})

describe('lvr', () => {
  it('is the loan over the property value', () => {
    expect(lvr(800_000_00, 1_000_000_00)).toBe(0.8)
  })

  it('uses the property value, not the purchase price, so buying under value helps', () => {
    expect(lvr(800_000_00, 1_100_000_00)).toBeCloseTo(0.727, 3)
  })

  it('returns zero rather than infinity when there is no value', () => {
    expect(lvr(800_000_00, 0)).toBe(0)
  })
})

describe('equity', () => {
  it('is the value less the loan', () => expect(equity(1_000_000_00, 800_000_00)).toBe(200_000_00))
  it('goes negative when the loan is underwater', () =>
    expect(equity(700_000_00, 800_000_00)).toBe(-100_000_00))
})

describe('deriveFinancing', () => {
  it('derives the loan from a deposit', () => {
    const result = deriveFinancing({
      purchasePrice: 1_000_000_00,
      source: 'deposit',
      deposit: 200_000_00,
    })
    expect(result.loanAmount).toBe(800_000_00)
    expect(result.depositPercentage).toBe(0.2)
    expect(result.lvr).toBe(0.8)
  })

  it('derives the deposit from a loan amount', () => {
    const result = deriveFinancing({
      purchasePrice: 1_000_000_00,
      source: 'loanAmount',
      loanAmount: 750_000_00,
    })
    expect(result.deposit).toBe(250_000_00)
    expect(result.depositPercentage).toBe(0.25)
  })

  it('derives both from a deposit percentage', () => {
    const result = deriveFinancing({
      purchasePrice: 1_000_000_00,
      source: 'depositPercentage',
      depositPercentage: 0.15,
    })
    expect(result.deposit).toBe(150_000_00)
    expect(result.loanAmount).toBe(850_000_00)
  })

  it('ignores the fields the source does not name, so inputs cannot fight', () => {
    const result = deriveFinancing({
      purchasePrice: 1_000_000_00,
      source: 'deposit',
      deposit: 200_000_00,
      loanAmount: 1_00,
    })
    expect(result.loanAmount).toBe(800_000_00)
  })

  it('measures LVR against a separate property value when given one', () => {
    const result = deriveFinancing({
      purchasePrice: 1_000_000_00,
      propertyValue: 1_250_000_00,
      source: 'deposit',
      deposit: 250_000_00,
    })
    expect(result.loanAmount).toBe(750_000_00)
    expect(result.lvr).toBe(0.6)
  })

  it('flags a deposit above the purchase price and never returns a negative loan', () => {
    const result = deriveFinancing({
      purchasePrice: 500_000_00,
      source: 'deposit',
      deposit: 600_000_00,
    })
    expect(result.depositExceedsPrice).toBe(true)
    expect(result.loanAmount).toBe(0)
  })

  it('handles a zero purchase price', () => {
    const result = deriveFinancing({ purchasePrice: 0, source: 'deposit', deposit: 0 })
    expect(result.depositPercentage).toBe(0)
    expect(result.lvr).toBe(0)
  })
})

describe('sensitivity', () => {
  const rows = sensitivity([0.04, 0.06, 0.08], standard)

  it('returns one row per configured rate', () => expect(rows).toHaveLength(3))

  it('shows no difference at the rate the loan already has', () => {
    expect(rows[1]?.annualRate).toBe(0.06)
    expect(rows[1]?.monthlyDifference).toBe(0)
  })

  it('costs less at a lower rate and more at a higher one', () => {
    expect(rows[0]?.monthlyDifference).toBeLessThan(0)
    expect(rows[2]?.monthlyDifference).toBeGreaterThan(0)
  })

  it('reports the annual figure as twelve monthly ones', () => {
    const row = rows[0]
    expect(row?.annualRepayment).toBe((row?.monthlyRepayment ?? 0) * 12)
  })
})
