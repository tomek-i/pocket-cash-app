import { describe, expect, it } from 'vitest'
import { convertFrequency, normalise, normaliseTotal, occurrencesPerYear } from './recurrence'

describe('occurrencesPerYear', () => {
  it('counts each frequency', () => {
    expect(occurrencesPerYear({ amount: 0, frequency: 'weekly' })).toBe(52)
    expect(occurrencesPerYear({ amount: 0, frequency: 'fortnightly' })).toBe(26)
    expect(occurrencesPerYear({ amount: 0, frequency: 'monthly' })).toBe(12)
    expect(occurrencesPerYear({ amount: 0, frequency: 'quarterly' })).toBe(4)
    expect(occurrencesPerYear({ amount: 0, frequency: 'halfYearly' })).toBe(2)
    expect(occurrencesPerYear({ amount: 0, frequency: 'annual' })).toBe(1)
  })

  it('uses the custom cadence when given one', () => {
    expect(occurrencesPerYear({ amount: 0, frequency: 'custom', customPerYear: 3 })).toBe(3)
  })

  it('treats a custom cadence with no count as never', () => {
    expect(occurrencesPerYear({ amount: 0, frequency: 'custom' })).toBe(0)
  })
})

describe('normalise', () => {
  it('annualises a weekly amount over 52 weeks, not 48', () => {
    // Weekly times four understates the year by roughly 8%. This is the check
    // that keeps that mistake out.
    const result = normalise({ amount: 600_00, frequency: 'weekly' })
    expect(result.annual).toBe(31_200_00)
    expect(result.monthly).toBe(2_600_00)
    expect(result.monthly).not.toBe(2_400_00)
  })

  it('annualises a fortnightly amount over 26 fortnights', () => {
    const result = normalise({ amount: 500_00, frequency: 'fortnightly' })
    expect(result.annual).toBe(13_000_00)
  })

  it('annualises a quarterly amount', () => {
    const result = normalise({ amount: 400_00, frequency: 'quarterly' })
    expect(result.annual).toBe(1_600_00)
    expect(result.monthly).toBe(133_33)
  })

  it('passes a monthly amount straight through', () => {
    const result = normalise({ amount: 100_00, frequency: 'monthly' })
    expect(result.monthly).toBe(100_00)
    expect(result.annual).toBe(1_200_00)
  })

  it('splits an annual amount into twelfths', () => {
    const result = normalise({ amount: 1_400_00, frequency: 'annual' })
    expect(result.monthly).toBe(11_667)
  })

  it('handles a custom cadence', () => {
    expect(normalise({ amount: 100_00, frequency: 'custom', customPerYear: 3 }).annual).toBe(300_00)
  })
})

describe('normaliseTotal', () => {
  it('sums mixed frequencies into one monthly and annual figure', () => {
    const total = normaliseTotal([
      { amount: 400_00, frequency: 'quarterly' },
      { amount: 1_400_00, frequency: 'annual' },
      { amount: 60_00, frequency: 'monthly' },
    ])
    expect(total.annual).toBe(3_720_00)
    expect(total.monthly).toBe(310_00)
  })

  it('is zero for an empty list', () => {
    expect(normaliseTotal([])).toEqual({ annual: 0, monthly: 0 })
  })
})

describe('convertFrequency', () => {
  it('shows a weekly rent as a monthly figure', () => {
    expect(convertFrequency(600_00, 'weekly', 'monthly')).toBe(2_600_00)
  })

  it('shows a monthly rent as a weekly figure', () => {
    expect(convertFrequency(2_600_00, 'monthly', 'weekly')).toBe(600_00)
  })

  it('round-trips within a cent', () => {
    const weekly = 575_00
    const monthly = convertFrequency(weekly, 'weekly', 'monthly')
    expect(Math.abs(convertFrequency(monthly, 'monthly', 'weekly') - weekly)).toBeLessThanOrEqual(1)
  })

  it('returns zero when a cadence never occurs', () => {
    expect(convertFrequency(100_00, 'custom', 'monthly')).toBe(0)
  })
})
