import { type CashPosition, cashPosition } from '@repo/property'

/**
 * Available funds against what the purchase needs.
 *
 * The planner's primary answer is "what balance would I need", which is cash
 * required. This is the secondary one: "and do I have it". Funds are typed in by
 * hand and never read from account balances, so the number is whatever the user
 * says it is rather than whatever the last CSV import implied.
 */

/** A `property_available_funds` row, reduced to what the maths needs. */
export interface AvailableFundRow {
  id: string
  label: string
  /** Minor units. */
  amount: number
  enabled: boolean
}

export interface FundsSummary {
  funds: AvailableFundRow[]
  /** Minor units. Enabled funds only. */
  total: number
  position: CashPosition
  /**
   * True when nothing has been recorded, so the position is unknown rather than
   * zero.
   *
   * Without this the difference is invisible: an empty table totals zero, which
   * subtracts to a full shortfall, so a brand new property opened with a red
   * "short by $293,687" before the user had typed anything. That is an artefact
   * of an empty table, not a finding, and spending the page's only alarm colour
   * on it trains the alarm away before a real shortfall ever appears.
   */
  unknown: boolean
}

/** Total the enabled funds and compare them against the cash required. */
export function summariseFunds(funds: AvailableFundRow[], cashRequired: number): FundsSummary {
  const total = funds.filter((fund) => fund.enabled).reduce((sum, fund) => sum + fund.amount, 0)

  return {
    funds,
    total,
    position: cashPosition(total, cashRequired),
    // Recorded and set to zero is a real answer; nothing recorded is not.
    unknown: funds.length === 0,
  }
}
