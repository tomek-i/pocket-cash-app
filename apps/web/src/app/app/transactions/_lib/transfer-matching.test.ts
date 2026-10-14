import { describe, expect, it } from 'vitest'
import {
  dismissalKey,
  looksLikeTransfer,
  pickTransferPairs,
  type TransferCandidate,
  type TransferSide,
} from './transfer-matching'

function side(id: string, date: string, overrides: Partial<TransferSide> = {}): TransferSide {
  return {
    id,
    date,
    description: 'Payment',
    displayName: null,
    accountName: id.startsWith('o') ? 'Everyday Checking' : 'Rainy Day Savings',
    flagged: false,
    ...overrides,
  }
}

function pair(out: TransferSide, inSide: TransferSide): TransferCandidate {
  return { out, in: inSide, amount: 40_000, currency: 'AUD' }
}

describe('looksLikeTransfer', () => {
  it('spots transfer wording in either description', () => {
    expect(
      looksLikeTransfer(
        pair(side('o1', '2026-09-26', { description: 'TFR 12345' }), side('i1', '2026-09-26')),
      ),
    ).toBe(true)
  })

  it('spots the other account named in the narrative', () => {
    expect(
      looksLikeTransfer(
        pair(
          side('o1', '2026-09-26', { description: 'To RAINY-DAY savings 991' }),
          side('i1', '2026-09-26'),
        ),
      ),
    ).toBe(true)
  })

  it('counts a side already marked or filed as a transfer', () => {
    expect(
      looksLikeTransfer(
        pair(side('o1', '2026-09-26'), side('i1', '2026-09-26', { flagged: true })),
      ),
    ).toBe(true)
  })

  it('is not convinced by a matching amount alone', () => {
    expect(looksLikeTransfer(pair(side('o1', '2026-09-26'), side('i1', '2026-09-27')))).toBe(false)
  })
})

describe('pickTransferPairs', () => {
  it('gives each transaction at most one partner, closest date first', () => {
    const out = side('o1', '2026-09-26')
    const near = side('i1', '2026-09-26')
    const far = side('i2', '2026-09-22')
    const picked = pickTransferPairs([pair(out, far), pair(out, near)])
    expect(picked).toHaveLength(1)
    expect(picked[0]?.in.id).toBe('i1')
    expect(picked[0]?.gapDays).toBe(0)
  })

  it('prefers a likely pair over a closer plain match', () => {
    const out = side('o1', '2026-09-26')
    const plain = side('i1', '2026-09-26')
    const worded = side('i2', '2026-09-28', { description: 'Transfer from Everyday Checking' })
    const picked = pickTransferPairs([pair(out, plain), pair(out, worded)])
    expect(picked.map((p) => p.in.id)).toEqual(['i2'])
    expect(picked[0]?.likely).toBe(true)
  })

  it('pairs two monthly transfers with their own months', () => {
    const picked = pickTransferPairs([
      pair(side('o1', '2026-08-26'), side('i1', '2026-08-26')),
      pair(side('o1', '2026-08-26'), side('i2', '2026-08-29')),
      pair(side('o2', '2026-08-29'), side('i2', '2026-08-29')),
      pair(side('o2', '2026-08-29'), side('i1', '2026-08-26')),
    ])
    expect(picked.map((p) => `${p.out.id}-${p.in.id}`).sort()).toEqual(['o1-i1', 'o2-i2'])
  })

  it('never suggests a dismissed pair', () => {
    const out = side('o1', '2026-09-26')
    const inSide = side('i1', '2026-09-26')
    expect(pickTransferPairs([pair(out, inSide)], new Set([dismissalKey('o1', 'i1')]))).toEqual([])
  })
})
