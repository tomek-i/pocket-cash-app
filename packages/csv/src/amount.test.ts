import { describe, expect, it } from 'vitest'
import { parseSignedDecimal, parseSingleAmount, parseSplitAmount } from './amount'

const usd = { decimal: '.', thousands: ',', minorUnitDigits: 2, parensNegative: false }
const eur = { decimal: ',', thousands: '.', minorUnitDigits: 2, parensNegative: false }

describe('parseSignedDecimal', () => {
  it('parses a plain decimal to minor units', () =>
    expect(parseSignedDecimal('12.34', usd)).toBe(1234))
  it('strips thousands separators', () => expect(parseSignedDecimal('1,234.50', usd)).toBe(123450))
  it('parses negatives', () => expect(parseSignedDecimal('-5.40', usd)).toBe(-540))
  it('parses an integer (no decimals)', () => expect(parseSignedDecimal('100', usd)).toBe(10000))
  it('parses European 1.234,50', () => expect(parseSignedDecimal('1.234,50', eur)).toBe(123450))
  it('treats parentheses as negative when enabled', () =>
    expect(parseSignedDecimal('(12.34)', { ...usd, parensNegative: true })).toBe(-1234))
  it('strips a currency symbol', () => expect(parseSignedDecimal('$1,000.00', usd)).toBe(100000))
  it('honours 0 minor-unit digits (JPY)', () =>
    expect(parseSignedDecimal('1,234', { ...usd, minorUnitDigits: 0 })).toBe(1234))
  it('truncates extra fraction digits', () => expect(parseSignedDecimal('1.999', usd)).toBe(199))
  it('returns null for a blank cell', () => expect(parseSignedDecimal('   ', usd)).toBeNull())
})

describe('parseSingleAmount', () => {
  it('passes the sign through', () =>
    expect(parseSingleAmount('5.40', { ...usd, flipSign: false })).toBe(540))
  it('inverts when flipSign is set', () =>
    expect(parseSingleAmount('5.40', { ...usd, flipSign: true })).toBe(-540))
})

describe('parseSplitAmount', () => {
  const fmt = { ...usd, flipSign: false }
  it('credit column → positive', () => expect(parseSplitAmount('', '100.00', fmt)).toBe(10000))
  it('debit column → negative', () => expect(parseSplitAmount('86.40', '', fmt)).toBe(-8640))
  it('uses magnitudes regardless of source sign', () =>
    expect(parseSplitAmount('-86.40', '', fmt)).toBe(-8640))
  it('returns null when both sides are empty', () =>
    expect(parseSplitAmount('', '', fmt)).toBeNull())
  it('inverts when flipSign is set', () =>
    expect(parseSplitAmount('86.40', '', { ...fmt, flipSign: true })).toBe(8640))
})
