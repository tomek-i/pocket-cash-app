import { describe, expect, it } from 'vitest'
import type { DedupeField } from './config'
import { fingerprint } from './fingerprint'
import type { CanonicalTransaction } from './parse'

const base: CanonicalTransaction = {
  date: '2026-06-24',
  amount: -540,
  description: 'Aster Coffee',
  rawData: { Date: '24/06/2026', Description: 'Aster Coffee', Amount: '-5.40', Balance: '100.00' },
}

const fields: DedupeField[] = ['date', 'amount', 'description', 'reference']
const fpFields = (txn: CanonicalTransaction, accountId = 'acc-1') =>
  fingerprint(txn, { accountId, strategy: 'fields', fields })
const fpRow = (txn: CanonicalTransaction, accountId = 'acc-1') =>
  fingerprint(txn, { accountId, strategy: 'fullRow' })

describe('fingerprint — full row (default)', () => {
  it('defaults to full-row when no strategy is given', () => {
    expect(fingerprint(base, { accountId: 'acc-1' })).toBe(fpRow(base))
  })

  it('is deterministic and fixed-length hex', () => {
    expect(fpRow(base)).toBe(fpRow(base))
    expect(fpRow(base)).toMatch(/^[0-9a-f]{16}$/)
  })

  it('changes per account', () => {
    expect(fpRow(base, 'acc-1')).not.toBe(fpRow(base, 'acc-2'))
  })

  it('treats byte-identical rows as duplicates (idempotent re-import)', () => {
    const again: CanonicalTransaction = { ...base, rawData: { ...base.rawData } }
    expect(fpRow(base)).toBe(fpRow(again))
  })

  it('distinguishes two same-day same-amount coffees that differ only by balance', () => {
    const coffee1 = { ...base, rawData: { ...base.rawData, Balance: '100.00' } }
    const coffee2 = { ...base, rawData: { ...base.rawData, Balance: '94.60' } }
    expect(fpRow(coffee1)).not.toBe(fpRow(coffee2))
  })

  it('ignores incidental surrounding whitespace in a column', () => {
    const padded = { ...base, rawData: { ...base.rawData, Description: '  Aster Coffee  ' } }
    expect(fpRow(base)).toBe(fpRow(padded))
  })

  it('is independent of column insertion order', () => {
    const reordered: CanonicalTransaction = {
      ...base,
      rawData: {
        Balance: '100.00',
        Amount: '-5.40',
        Description: 'Aster Coffee',
        Date: '24/06/2026',
      },
    }
    expect(fpRow(base)).toBe(fpRow(reordered))
  })
})

describe('fingerprint — fields strategy (opt-in)', () => {
  it('is deterministic and fixed-length hex', () => {
    expect(fpFields(base)).toBe(fpFields(base))
    expect(fpFields(base)).toMatch(/^[0-9a-f]{16}$/)
  })

  it('ignores case and whitespace in the description', () => {
    expect(fpFields(base)).toBe(fpFields({ ...base, description: '  ASTER   coffee ' }))
  })

  it('changes when the amount changes', () => {
    expect(fpFields(base)).not.toBe(fpFields({ ...base, amount: -541 }))
  })

  it('distinguishes otherwise-identical rows by reference', () => {
    expect(fpFields({ ...base, reference: 'T1' })).not.toBe(fpFields({ ...base, reference: 'T2' }))
  })

  it('collides on the running balance (which is why full-row is the default)', () => {
    // The bug the user hit: balance isn't a default field, so two distinct
    // coffees collapse to one fingerprint under the fields strategy.
    const coffee1 = { ...base, balance: 10000 }
    const coffee2 = { ...base, balance: 9460 }
    expect(fpFields(coffee1)).toBe(fpFields(coffee2))
  })
})
