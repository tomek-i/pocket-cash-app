import type { Property } from '@repo/database'
import { equity, lvr } from '@repo/property'
import type { PropertyStatus } from '@repo/types'

/**
 * Portfolio aggregation. Pure functions over plain numbers so they can be
 * tested without a database, and so the maths stays out of the components.
 *
 * Two decisions worth knowing when reading a total:
 *
 * - **Sold properties are excluded.** They are kept for history, not counted as
 *   part of what the user holds today.
 * - **Ownership share is applied to value and debt alike.** A half share of a
 *   $1,000,000 property with an $800,000 loan counts as $500,000 of value and
 *   $400,000 of debt, so the equity shown is the user's own $100,000.
 */

/** The subset of a property row the portfolio maths needs. */
export interface PortfolioInput {
  id: string
  status: PropertyStatus
  /** Decimal share owned, `1` being outright. */
  ownershipShare: number
  /** Minor units. What it would sell for today. */
  marketValue: number | null
  /** Minor units. */
  purchasePrice: number
  /** Minor units. Total borrowed against it. */
  loanBalance: number
  /** Minor units. Cash sitting in accounts offsetting those loans. */
  offsetBalance: number
}

export interface PropertyPosition {
  id: string
  /** Minor units, before the ownership share is applied. */
  value: number
  /** Minor units, before the ownership share is applied. */
  debt: number
  /** Minor units, before the ownership share is applied. */
  equity: number
  /** Decimal ratio. Independent of the share, since it applies to both sides. */
  lvr: number
  /** Minor units, the user's share of the value. */
  shareOfValue: number
  /** Minor units, the user's share of the debt. */
  shareOfDebt: number
  /** Minor units, the user's share of the equity. */
  shareOfEquity: number
  /** Minor units, before the ownership share is applied. */
  offset: number
  /**
   * Minor units. What would still be owed if the offset were used to pay the
   * loan down. Never negative: an offset larger than the loan clears it and the
   * rest is simply cash, which lands in `netEquity` instead.
   */
  netDebt: number
  /**
   * Minor units. The position including the offset cash, `value - debt + offset`.
   *
   * Kept separate from `equity` rather than replacing it, because the two answer
   * different questions. `equity` is how much of the property is yours, which is
   * what a lender measures and what LVR is built on. `netEquity` is where you
   * actually stand, which is what you want when deciding whether you are ahead.
   * Quietly merging them would also double count: the same cash can sit in
   * available funds or an account balance.
   */
  netEquity: number
  /** Excluded from portfolio totals. */
  countsTowardsTotals: boolean
}

/**
 * A stored property and its loans, reduced to what the portfolio maths needs.
 *
 * Loans are summed rather than taking the first: a property can carry more than
 * one, and the debt against it is all of them.
 */
export function toPortfolioInput(
  property: Property & { loans: { loanAmount: number; offsetBalance: number }[] },
): PortfolioInput {
  return {
    id: property.id,
    status: property.status,
    ownershipShare: property.ownershipShare,
    marketValue: property.marketValue,
    purchasePrice: property.purchasePrice,
    loanBalance: property.loans.reduce((total, loan) => total + loan.loanAmount, 0),
    offsetBalance: property.loans.reduce((total, loan) => total + loan.offsetBalance, 0),
  }
}

/**
 * The value to measure a property by.
 *
 * What it is worth, falling back to what was paid. A property that has never
 * been valued still has to show something, and the price paid is a better answer
 * than zero.
 */
export function propertyValue(property: PortfolioInput): number {
  return property.marketValue ?? property.purchasePrice
}

/** One property's position. */
export function propertyPosition(property: PortfolioInput): PropertyPosition {
  const value = propertyValue(property)
  const debt = property.loanBalance
  const offset = property.offsetBalance
  const share = property.ownershipShare

  return {
    id: property.id,
    value,
    debt,
    equity: equity(value, debt),
    // On the full loan, deliberately. An offset does not reduce what is owed, and
    // a lender reads this ratio gross, so netting it here would overstate what is
    // left to borrow everywhere borrowing headroom is worked out.
    lvr: lvr(debt, value),
    offset,
    netDebt: Math.max(0, debt - offset),
    netEquity: equity(value, debt) + offset,
    shareOfValue: Math.round(value * share),
    shareOfDebt: Math.round(debt * share),
    shareOfEquity: Math.round(equity(value, debt) * share),
    countsTowardsTotals: property.status !== 'sold',
  }
}

export interface PortfolioTotals {
  /** Minor units. */
  value: number
  /** Minor units. */
  debt: number
  /** Minor units. Can be negative when the loans exceed the values. */
  equity: number
  /** Decimal ratio across the whole portfolio. */
  lvr: number
  /** How many properties are counted. Sold ones are not. */
  count: number
}

/**
 * Only what is held today.
 *
 * A planned purchase is a proposal rather than a holding, so it is not part of
 * what you own and its loan is not money you owe. Keeping that distinction in
 * one function is what stops the headline totals and the impact maths drifting
 * apart on the answer.
 */
export function ownedProperties(properties: PortfolioInput[]): PortfolioInput[] {
  return properties.filter((property) => property.status === 'existing')
}

/** Totals across every property counted, sold ones excluded. */
export function portfolioTotals(properties: PortfolioInput[]): PortfolioTotals {
  const counted = properties.map(propertyPosition).filter((p) => p.countsTowardsTotals)

  const value = counted.reduce((total, p) => total + p.shareOfValue, 0)
  const debt = counted.reduce((total, p) => total + p.shareOfDebt, 0)

  return { value, debt, equity: equity(value, debt), lvr: lvr(debt, value), count: counted.length }
}
