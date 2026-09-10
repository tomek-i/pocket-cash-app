import { describe, expect, it } from 'vitest'
import {
  ownedProperties,
  type PortfolioInput,
  portfolioTotals,
  propertyPosition,
  propertyValue,
} from './portfolio'

function property(overrides: Partial<PortfolioInput> = {}): PortfolioInput {
  return {
    id: 'p1',
    status: 'existing',
    ownershipShare: 1,
    currentValue: 1_000_000_00,
    estimatedMarketValue: null,
    purchasePrice: 900_000_00,
    loanBalance: 800_000_00,
    ...overrides,
  }
}

describe('propertyValue', () => {
  it('prefers the current value', () => {
    expect(propertyValue(property())).toBe(1_000_000_00)
  })

  it('falls back to the estimate when there is no current value', () => {
    expect(
      propertyValue(property({ currentValue: null, estimatedMarketValue: 1_100_000_00 })),
    ).toBe(1_100_000_00)
  })

  it('falls back to the purchase price rather than zero', () => {
    expect(propertyValue(property({ currentValue: null, estimatedMarketValue: null }))).toBe(
      900_000_00,
    )
  })

  it('treats a zero current value as a real value, not as missing', () => {
    expect(propertyValue(property({ currentValue: 0 }))).toBe(0)
  })
})

describe('propertyPosition', () => {
  it('reports equity and LVR', () => {
    const position = propertyPosition(property())
    expect(position.equity).toBe(200_000_00)
    expect(position.lvr).toBe(0.8)
  })

  it('goes negative when the loan is underwater', () => {
    const position = propertyPosition(property({ currentValue: 700_000_00 }))
    expect(position.equity).toBe(-100_000_00)
  })

  it('applies the ownership share to value, debt and equity', () => {
    const position = propertyPosition(property({ ownershipShare: 0.5 }))
    expect(position.shareOfValue).toBe(500_000_00)
    expect(position.shareOfDebt).toBe(400_000_00)
    expect(position.shareOfEquity).toBe(100_000_00)
  })

  it('leaves LVR untouched by the ownership share, since it applies to both sides', () => {
    expect(propertyPosition(property({ ownershipShare: 0.5 })).lvr).toBe(0.8)
    expect(propertyPosition(property({ ownershipShare: 1 })).lvr).toBe(0.8)
  })

  it('marks a sold property as not counting', () => {
    expect(propertyPosition(property({ status: 'sold' })).countsTowardsTotals).toBe(false)
    expect(propertyPosition(property({ status: 'planned' })).countsTowardsTotals).toBe(true)
  })

  it('reports no LVR for a property with no value rather than dividing by zero', () => {
    const position = propertyPosition(
      property({ currentValue: 0, estimatedMarketValue: null, purchasePrice: 0 }),
    )
    expect(position.lvr).toBe(0)
  })
})

describe('portfolioTotals', () => {
  it('is empty for no properties', () => {
    expect(portfolioTotals([])).toEqual({ value: 0, debt: 0, equity: 0, lvr: 0, count: 0 })
  })

  it('sums value, debt and equity', () => {
    const totals = portfolioTotals([
      property({ id: 'a' }),
      property({ id: 'b', currentValue: 500_000_00, loanBalance: 200_000_00 }),
    ])
    expect(totals.value).toBe(1_500_000_00)
    expect(totals.debt).toBe(1_000_000_00)
    expect(totals.equity).toBe(500_000_00)
    expect(totals.count).toBe(2)
  })

  it('excludes sold properties', () => {
    const totals = portfolioTotals([
      property({ id: 'a' }),
      property({ id: 'b', status: 'sold', currentValue: 5_000_000_00, loanBalance: 0 }),
    ])
    expect(totals.value).toBe(1_000_000_00)
    expect(totals.count).toBe(1)
  })

  // The totals exclude sold properties and nothing else. Deciding that a planned
  // purchase is not part of what you hold is the caller's job, via
  // `ownedProperties`, because the planner needs both readings.
  it('counts a planned purchase, since sold is the only thing it drops', () => {
    const totals = portfolioTotals([
      property({ id: 'a' }),
      property({
        id: 'b',
        status: 'planned',
        currentValue: null,
        estimatedMarketValue: null,
        purchasePrice: 800_000_00,
        loanBalance: 640_000_00,
      }),
    ])
    expect(totals.value).toBe(1_800_000_00)
    expect(totals.debt).toBe(1_440_000_00)
  })

  it('counts only the user share of a jointly owned property', () => {
    const totals = portfolioTotals([property({ ownershipShare: 0.5 })])
    expect(totals.value).toBe(500_000_00)
    expect(totals.debt).toBe(400_000_00)
    expect(totals.equity).toBe(100_000_00)
  })

  it('reports portfolio LVR across every counted property', () => {
    const totals = portfolioTotals([
      property({ id: 'a', currentValue: 1_000_000_00, loanBalance: 800_000_00 }),
      property({ id: 'b', currentValue: 1_000_000_00, loanBalance: 200_000_00 }),
    ])
    expect(totals.lvr).toBe(0.5)
  })
})

describe('ownedProperties', () => {
  it('keeps only what is held today', () => {
    const owned = ownedProperties([
      property({ id: 'a' }),
      property({ id: 'b', status: 'planned' }),
      property({ id: 'c', status: 'sold' }),
    ])
    expect(owned.map((entry) => entry.id)).toEqual(['a'])
  })

  it('leaves the headline totals free of debt that has not been borrowed', () => {
    const properties = [
      property({ id: 'a', loanBalance: 640_000_00 }),
      property({ id: 'b', status: 'planned', loanBalance: 850_000_00 }),
    ]

    expect(portfolioTotals(properties).debt).toBe(1_490_000_00)
    expect(portfolioTotals(ownedProperties(properties)).debt).toBe(640_000_00)
  })
})
