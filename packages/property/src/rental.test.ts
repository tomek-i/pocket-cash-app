import { describe, expect, it } from 'vitest'
import { propertyCashFlow, summariseRental } from './rental'

describe('summariseRental', () => {
  const input = {
    rent: 600_00,
    rentFrequency: 'weekly' as const,
    vacancyRate: 0.02,
    managementRate: 0.07,
  }

  it('annualises the rent over 52 weeks', () => {
    expect(summariseRental(input).grossAnnualRent).toBe(31_200_00)
  })

  it('deducts vacancy from the gross rent', () => {
    expect(summariseRental(input).vacancyLoss).toBe(624_00)
  })

  it('charges management on collected rent, not on advertised rent', () => {
    // 7% of $30,576, not 7% of $31,200.
    expect(summariseRental(input).managementFee).toBe(2_140_32)
  })

  it('reports the rent left after both deductions', () => {
    expect(summariseRental(input).effectiveAnnualRent).toBe(28_435_68)
  })

  it('deducts nothing when no rates are given', () => {
    const result = summariseRental({ rent: 600_00, rentFrequency: 'weekly' })
    expect(result.vacancyLoss).toBe(0)
    expect(result.managementFee).toBe(0)
    expect(result.effectiveAnnualRent).toBe(31_200_00)
  })
})

describe('propertyCashFlow', () => {
  const input = {
    rent: 600_00,
    rentFrequency: 'weekly' as const,
    vacancyRate: 0.02,
    managementRate: 0.07,
    propertyValue: 1_000_000_00,
    annualOperatingExpenses: 5_000_00,
    annualInterest: 48_000_00,
    annualPrincipal: 9_700_00,
  }
  const result = propertyCashFlow(input)

  it('reports net operating income before financing', () => {
    expect(result.netOperatingIncome).toBe(23_435_68)
  })

  it('reports gross yield against the property value', () => {
    expect(result.grossYield).toBeCloseTo(0.0312, 6)
  })

  it('reports net yield from operating income, excluding the loan', () => {
    expect(result.netYield).toBeCloseTo(0.0234, 4)
    expect(result.netYield).toBeLessThan(result.grossYield)
  })

  it('separates cash flow before and after principal', () => {
    expect(result.annualCashFlowBeforePrincipal).toBe(-24_564_32)
    expect(result.annualCashFlow).toBe(-34_264_32)
    expect(result.annualCashFlow).toBeLessThan(result.annualCashFlowBeforePrincipal)
  })

  it('reports monthly cash flow as a twelfth of the annual figure', () => {
    expect(result.monthlyCashFlow).toBe(-2_855_36)
  })

  it('flags a negatively geared property', () => {
    expect(result.negative).toBe(true)
  })

  it('is positive when the rent covers everything', () => {
    const strong = propertyCashFlow({ ...input, rent: 1_500_00 })
    expect(strong.annualCashFlow).toBeGreaterThan(0)
    expect(strong.negative).toBe(false)
  })

  it('returns zero yields rather than infinity when there is no value', () => {
    const valueless = propertyCashFlow({ ...input, propertyValue: 0 })
    expect(valueless.grossYield).toBe(0)
    expect(valueless.netYield).toBe(0)
  })
})
