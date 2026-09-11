import { describe, expect, it } from 'vitest'
import { type AvailableFundRow, summariseFunds } from './funds'

function fund(overrides: Partial<AvailableFundRow> = {}): AvailableFundRow {
  return { id: 'f1', label: 'Savings', amount: 180_000_00, enabled: true, ...overrides }
}

describe('summariseFunds', () => {
  it('totals the enabled funds', () => {
    const summary = summariseFunds(
      [
        fund({ id: 'a', label: 'Savings', amount: 180_000_00 }),
        fund({ id: 'b', label: 'Term deposit', amount: 60_000_00 }),
        fund({ id: 'c', label: 'Gift', amount: 40_000_00 }),
      ],
      293_937_00,
    )
    expect(summary.total).toBe(280_000_00)
  })

  it('reports the shortfall when the funds fall short', () => {
    // The worked example: $280,000 against $293,937 of cash required.
    const summary = summariseFunds([fund({ amount: 280_000_00 })], 293_937_00)
    expect(summary.position.remaining).toBe(-13_937_00)
    expect(summary.position.shortfall).toBe(true)
  })

  it('reports what is left over when they cover it', () => {
    const summary = summariseFunds([fund({ amount: 320_000_00 })], 293_937_00)
    expect(summary.position.remaining).toBe(26_063_00)
    expect(summary.position.shortfall).toBe(false)
  })

  it('does not treat an exact match as a shortfall', () => {
    const summary = summariseFunds([fund({ amount: 293_937_00 })], 293_937_00)
    expect(summary.position.remaining).toBe(0)
    expect(summary.position.shortfall).toBe(false)
  })

  it('leaves disabled funds out of the total but keeps them in the list', () => {
    const summary = summariseFunds(
      [
        fund({ id: 'a', amount: 180_000_00 }),
        fund({ id: 'b', amount: 100_000_00, enabled: false }),
      ],
      293_937_00,
    )
    expect(summary.total).toBe(180_000_00)
    expect(summary.funds).toHaveLength(2)
  })

  it('is a full shortfall when nothing is recorded', () => {
    const summary = summariseFunds([], 293_937_00)
    expect(summary.total).toBe(0)
    expect(summary.position.remaining).toBe(-293_937_00)
    expect(summary.position.shortfall).toBe(true)
  })
})

describe('nothing recorded', () => {
  it('is unknown rather than a shortfall', () => {
    // An empty table totals zero, which subtracts to a full shortfall. That is an
    // artefact, not a finding, and it used to greet every new property in red.
    const summary = summariseFunds([], 293_937_00)
    expect(summary.unknown).toBe(true)
  })

  it('is a real answer once a fund exists, even at zero', () => {
    const summary = summariseFunds([fund({ amount: 0 })], 293_937_00)
    expect(summary.unknown).toBe(false)
    expect(summary.position.shortfall).toBe(true)
  })

  it('is a real answer when the only fund is switched off', () => {
    // The user said something here: excluded money is a decision, not silence.
    const summary = summariseFunds([fund({ enabled: false })], 293_937_00)
    expect(summary.unknown).toBe(false)
  })
})
