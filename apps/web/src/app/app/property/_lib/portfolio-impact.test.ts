import { describe, expect, it } from 'vitest'
import type { PortfolioInput } from './portfolio'
import { borrowingHeadroom, type PortfolioImpactInput, portfolioImpact } from './portfolio-impact'

/**
 * The worked example throughout: one property already owned, and one being
 * planned.
 *
 * Owned is 5 Harbour View, worth $1,400,000 with $640,000 owed, so $760,000 of
 * equity at 45.7% LVR.
 */
const harbourView: PortfolioInput = {
  id: 'harbour-view',
  status: 'existing',
  ownershipShare: 1,
  marketValue: 1_400_000_00,
  purchasePrice: 1_200_000_00,
  loanBalance: 640_000_00,
  offsetBalance: 0,
}

function input(overrides: Partial<PortfolioImpactInput> = {}): PortfolioImpactInput {
  return {
    others: [harbourView],
    // Paying $1,100,000 for something valued at $1,050,000, with $250,000 down.
    purchase: { value: 1_050_000_00, debt: 850_000_00, ownershipShare: 1 },
    cashRequired: 293_687_00,
    maxLvr: 0.8,
    ...overrides,
  }
}

describe('portfolioImpact', () => {
  it('reports what is owned today, ignoring the purchase', () => {
    const { now } = portfolioImpact(input())

    expect(now.value).toBe(1_400_000_00)
    expect(now.debt).toBe(640_000_00)
    expect(now.equity).toBe(760_000_00)
    expect(now.lvr).toBeCloseTo(0.4571, 4)
  })

  it('adds the purchase to the totals', () => {
    const { after } = portfolioImpact(input())

    expect(after.value).toBe(2_450_000_00)
    expect(after.debt).toBe(1_490_000_00)
    expect(after.equity).toBe(960_000_00)
    expect(after.lvr).toBeCloseTo(0.6082, 4)
  })

  it('measures the change, with LVR as a decimal difference', () => {
    const { change } = portfolioImpact(input())

    expect(change.value).toBe(1_050_000_00)
    expect(change.debt).toBe(850_000_00)
    expect(change.equity).toBe(200_000_00)
    // 15.1 points, not 15.1 percent.
    expect(change.lvr).toBeCloseTo(0.151, 4)
  })

  it('shows the cash that does not come back as equity', () => {
    // $293,687 out, $200,000 of equity in. The $93,687 gap is the $50,000 paid
    // above valuation plus $43,687 of duty.
    expect(portfolioImpact(input()).equityForCash).toBe(-93_687_00)
  })

  it('comes out ahead when the discount beats the costs', () => {
    // The same deposit on a $1,000,000 price: $750,000 borrowed, $39,187 of duty.
    const impact = portfolioImpact(
      input({
        purchase: { value: 1_050_000_00, debt: 750_000_00, ownershipShare: 1 },
        cashRequired: 289_187_00,
      }),
    )

    expect(impact.change.equity).toBe(300_000_00)
    expect(impact.equityForCash).toBe(10_813_00)
  })

  it('excludes another planned purchase from both sides', () => {
    const alsoPlanned: PortfolioInput = {
      id: 'other-plan',
      status: 'planned',
      ownershipShare: 1,
      marketValue: 900_000_00,
      purchasePrice: 900_000_00,
      loanBalance: 700_000_00,
      offsetBalance: 0,
    }

    const impact = portfolioImpact(input({ others: [harbourView, alsoPlanned] }))

    expect(impact.now.value).toBe(1_400_000_00)
    expect(impact.after.value).toBe(2_450_000_00)
  })

  it('excludes a sold property, which portfolioTotals already drops', () => {
    const sold: PortfolioInput = { ...harbourView, id: 'sold', status: 'sold' }
    const impact = portfolioImpact(input({ others: [harbourView, sold] }))

    expect(impact.now.value).toBe(1_400_000_00)
  })

  it('applies the ownership share to a part-owned purchase', () => {
    const impact = portfolioImpact(
      input({ purchase: { value: 1_050_000_00, debt: 850_000_00, ownershipShare: 0.5 } }),
    )

    expect(impact.change.value).toBe(525_000_00)
    expect(impact.change.debt).toBe(425_000_00)
    expect(impact.change.equity).toBe(100_000_00)
  })

  it('starts from zero for a first purchase', () => {
    const impact = portfolioImpact(input({ others: [] }))

    expect(impact.now.value).toBe(0)
    expect(impact.now.lvr).toBe(0)
    // With nothing else owned, the portfolio LVR is just this property's.
    expect(impact.after.lvr).toBeCloseTo(850 / 1050, 4)
  })
})

describe('borrowingHeadroom', () => {
  const totals = (value: number, debt: number) => ({
    value,
    debt,
    equity: value - debt,
    lvr: value > 0 ? debt / value : 0,
    count: 1,
  })

  it('is what is left before the cap', () => {
    // 80% of $1,400,000 is $1,120,000, against $640,000 owed.
    expect(borrowingHeadroom(totals(1_400_000_00, 640_000_00), 0.8)).toBe(480_000_00)
  })

  it('goes negative once the cap is passed', () => {
    expect(borrowingHeadroom(totals(1_000_000_00, 900_000_00), 0.8)).toBe(-100_000_00)
  })

  it('can fall despite the purchase adding property', () => {
    // The counter-intuitive result worth surfacing: buying at $1.1m leaves less
    // borrowing capacity than before, while buying at $1.0m leaves more.
    const dear = portfolioImpact(input())
    const cheap = portfolioImpact(
      input({
        purchase: { value: 1_050_000_00, debt: 750_000_00, ownershipShare: 1 },
        cashRequired: 289_187_00,
      }),
    )

    expect(dear.headroom.now).toBe(480_000_00)
    expect(dear.headroom.after).toBe(470_000_00)
    expect(dear.headroom.change).toBe(-10_000_00)

    expect(cheap.headroom.after).toBe(570_000_00)
    expect(cheap.headroom.change).toBe(90_000_00)
  })
})

describe('without a cash figure', () => {
  it('reports the position but not what the cash bought', () => {
    // The portfolio list has no cheap way to know the upfront costs, so it asks
    // for the position without them rather than guessing at zero.
    const { cashRequired: _cash, ...rest } = input()
    const impact = portfolioImpact(rest)

    expect(impact.change.equity).toBe(200_000_00)
    expect(impact.equityForCash).toBeNull()
  })
})
