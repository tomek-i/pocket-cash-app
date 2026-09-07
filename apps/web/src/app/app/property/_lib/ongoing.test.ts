import { describe, expect, it } from 'vitest'
import { buildOngoing, type RecurringCostRow, summariseRecurringCosts } from './ongoing'

function cost(overrides: Partial<RecurringCostRow> = {}): RecurringCostRow {
  return {
    id: 'rc-1',
    name: 'Council Rates',
    category: 'government',
    amount: 400_00,
    frequency: 'quarterly',
    customPerYear: null,
    enabled: true,
    ...overrides,
  }
}

describe('summariseRecurringCosts', () => {
  it('annualises a quarterly cost', () => {
    const summary = summariseRecurringCosts([cost()])
    expect(summary.annual).toBe(1_600_00)
    expect(summary.monthly).toBe(133_33)
  })

  it('annualises a weekly cost over 52 weeks, not 48', () => {
    const summary = summariseRecurringCosts([cost({ amount: 100_00, frequency: 'weekly' })])
    expect(summary.annual).toBe(5_200_00)
    expect(summary.monthly).not.toBe(400_00)
  })

  it('sums mixed frequencies', () => {
    const summary = summariseRecurringCosts([
      cost({ id: 'a', amount: 400_00, frequency: 'quarterly' }),
      cost({ id: 'b', amount: 1_400_00, frequency: 'annual' }),
      cost({ id: 'c', amount: 60_00, frequency: 'monthly' }),
    ])
    expect(summary.annual).toBe(3_720_00)
    expect(summary.monthly).toBe(310_00)
  })

  it('leaves disabled costs out of the totals but keeps them in the list', () => {
    const summary = summariseRecurringCosts([
      cost({ id: 'a' }),
      cost({ id: 'b', amount: 1_000_00, frequency: 'annual', enabled: false }),
    ])
    expect(summary.annual).toBe(1_600_00)
    expect(summary.costs).toHaveLength(2)
  })

  it('groups by category', () => {
    const summary = summariseRecurringCosts([
      cost({ id: 'a', category: 'government', amount: 400_00, frequency: 'quarterly' }),
      cost({ id: 'b', category: 'insurance', amount: 1_400_00, frequency: 'annual' }),
    ])
    expect(summary.byCategory).toEqual({ government: 1_600_00, insurance: 1_400_00 })
  })

  it('handles a custom cadence', () => {
    const summary = summariseRecurringCosts([
      cost({ amount: 100_00, frequency: 'custom', customPerYear: 3 }),
    ])
    expect(summary.annual).toBe(300_00)
  })

  it('is zero for no costs', () => {
    expect(summariseRecurringCosts([])).toMatchObject({ monthly: 0, annual: 0 })
  })
})

describe('buildOngoing', () => {
  const base = {
    rows: [cost({ amount: 400_00, frequency: 'quarterly' })],
    propertyValue: 1_000_000_00,
    annualInterest: 48_000_00,
    annualPrincipal: 9_700_00,
    monthlyRepayment: 4_800_00,
  }

  it('adds the loan repayment to the holding costs', () => {
    const summary = buildOngoing({ ...base, rental: null })
    expect(summary.recurring.monthly).toBe(133_33)
    expect(summary.monthlyOutgoings).toBe(4_933_33)
  })

  it('reports no cash flow when the property is not let', () => {
    expect(buildOngoing({ ...base, rental: null }).cashFlow).toBeNull()
  })

  describe('when let', () => {
    const rental = {
      rent: 600_00,
      rentFrequency: 'weekly' as const,
      rentCustomPerYear: null,
      vacancyRate: 0.02,
      managementRate: 0.07,
    }
    const summary = buildOngoing({ ...base, rental })

    it('deducts the holding costs from the operating income', () => {
      // Effective rent 28,435.68 less 1,600 of rates.
      expect(summary.cashFlow?.netOperatingIncome).toBe(26_835_68)
    })

    it('reports gross and net yield', () => {
      expect(summary.cashFlow?.grossYield).toBeCloseTo(0.0312, 6)
      expect(summary.cashFlow?.netYield).toBeCloseTo(0.0268, 4)
    })

    it('separates cash flow before and after principal', () => {
      expect(summary.cashFlow?.annualCashFlowBeforePrincipal).toBe(-21_164_32)
      expect(summary.cashFlow?.annualCashFlow).toBe(-30_864_32)
    })

    it('flags a negatively geared property', () => {
      expect(summary.cashFlow?.negative).toBe(true)
    })

    it('turns positive when the rent covers everything', () => {
      const strong = buildOngoing({ ...base, rental: { ...rental, rent: 1_400_00 } })
      expect(strong.cashFlow?.negative).toBe(false)
    })

    it('counts only the enabled holding costs against the income', () => {
      const withDisabled = buildOngoing({
        ...base,
        rows: [
          ...base.rows,
          cost({ id: 'x', amount: 5_000_00, frequency: 'annual', enabled: false }),
        ],
        rental,
      })
      expect(withDisabled.cashFlow?.netOperatingIncome).toBe(26_835_68)
    })
  })
})
