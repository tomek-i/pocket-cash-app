import type { PortfolioInput, PortfolioTotals } from './portfolio'
import { ownedProperties, portfolioTotals } from './portfolio'

/**
 * What a purchase does to everything else you own.
 *
 * The planner answers "what does this cost". This answers the question that
 * follows: "and where does it leave me". They are not the same question, and the
 * second one has the less obvious answer, because a purchase can cost you cash
 * and still leave you better or worse off depending on what you paid relative to
 * what the place is worth.
 *
 * **"Now" counts only what you already own.** The portfolio page counts any
 * property that is not sold, which blends a purchase you are still thinking
 * about into your headline debt. Here a planned property is precisely the thing
 * being added, so counting it on both sides would show no change at all.
 */

/** The purchase as it currently stands, from the planner's working inputs. */
export interface ProspectivePurchase {
  /** Minor units. What it will be worth: the market value if estimated, else the price. */
  value: number
  /** Minor units. What will be owed against it. */
  debt: number
  /** Decimal share owned, `1` being outright. */
  ownershipShare: number
}

export interface PortfolioImpactInput {
  /** Every property except the one being planned. */
  others: PortfolioInput[]
  purchase: ProspectivePurchase
  /**
   * Minor units. Deposit plus upfront costs: what actually leaves the account.
   *
   * Optional because the portfolio list has no cheap way to know it. Evaluating
   * every property's costs to render a list would be the wrong trade, so that
   * page asks for the position without it and `equityForCash` comes back null.
   */
  cashRequired?: number
  /** Decimal. The portfolio LVR a lender will go to, from the calculation defaults. */
  maxLvr: number
}

export interface PortfolioChange {
  /** Minor units. */
  value: number
  /** Minor units. */
  debt: number
  /** Minor units. */
  equity: number
  /** Decimal difference. Quote it in points, never as a percentage. */
  lvr: number
}

export interface BorrowingHeadroom {
  /** Minor units. Negative means already past the cap. */
  now: number
  /** Minor units. */
  after: number
  /** Minor units. Negative means the purchase costs you capacity. */
  change: number
}

export interface PortfolioImpact {
  now: PortfolioTotals
  after: PortfolioTotals
  change: PortfolioChange
  /**
   * Minor units. Equity gained less the cash it took to gain it. Null when the
   * cash required was not supplied.
   *
   * Usually negative, and the size of it is the point. Buying at valuation loses
   * you exactly the transfer duty and fees; buying above valuation loses you
   * that too. Buying under valuation by more than the costs is the only way this
   * comes out positive.
   */
  equityForCash: number | null
  headroom: BorrowingHeadroom
}

/**
 * How much more could be borrowed before hitting the cap.
 *
 * Signed on purpose: a portfolio already past the cap returns a negative figure,
 * which is a real position and more useful than a floor of zero.
 */
export function borrowingHeadroom(totals: PortfolioTotals, maxLvr: number): number {
  return Math.round(totals.value * maxLvr) - totals.debt
}

/** The whole before-and-after picture. */
export function portfolioImpact(input: PortfolioImpactInput): PortfolioImpact {
  // Another purchase being planned in parallel is not part of this decision
  // either, which `ownedProperties` takes care of along with sold ones.
  const owned = ownedProperties(input.others)

  // The purchase as though it had settled, measured at what it is worth rather
  // than at what is being paid for it.
  const asOwned: PortfolioInput = {
    id: 'prospective',
    status: 'existing',
    ownershipShare: input.purchase.ownershipShare,
    marketValue: input.purchase.value,
    purchasePrice: input.purchase.value,
    loanBalance: input.purchase.debt,
    // A purchase being modelled has no offset account yet.
    offsetBalance: 0,
  }

  const now = portfolioTotals(owned)
  const after = portfolioTotals([...owned, asOwned])

  const headroomNow = borrowingHeadroom(now, input.maxLvr)
  const headroomAfter = borrowingHeadroom(after, input.maxLvr)

  return {
    now,
    after,
    change: {
      value: after.value - now.value,
      debt: after.debt - now.debt,
      equity: after.equity - now.equity,
      lvr: after.lvr - now.lvr,
    },
    equityForCash:
      input.cashRequired === undefined ? null : after.equity - now.equity - input.cashRequired,
    headroom: {
      now: headroomNow,
      after: headroomAfter,
      change: headroomAfter - headroomNow,
    },
  }
}
