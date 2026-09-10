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

  it('strips a non-breaking space', () => expect(parseSignedDecimal('1 234,50', eur)).toBe(123450))

  it('keeps grouping commas working when the mapping does not configure them', () =>
    // The default mapping leaves `thousands` empty. A comma cannot be the
    // decimal point once that has been normalised, so it can only be grouping.
    expect(parseSignedDecimal('1,234.50', { ...usd, thousands: '' })).toBe(123450))

  it('takes a trailing minus', () => expect(parseSignedDecimal('5.40-', usd)).toBe(-540))

  it('takes a leading plus', () => expect(parseSignedDecimal('+5.40', usd)).toBe(540))
})

/**
 * The bug behind #41. The parser used to keep only digits and dots, so a value
 * that was obviously not a number was salvaged into one instead of rejected, and
 * the salvaged figure passed validation. Every case here has to be null.
 */
describe('parseSignedDecimal rejects things that are not numbers', () => {
  it('rejects a date', () => expect(parseSignedDecimal('12/08/2026', usd)).toBeNull())

  it('rejects a narrative that happens to contain digits', () =>
    // This one used to yield 3021.
    expect(parseSignedDecimal('WOOLWORTHS 3021 NEWTOWN', usd)).toBeNull())

  it('rejects a narrative with no digits at all', () =>
    expect(parseSignedDecimal('SALARY ACME PTY LTD', usd)).toBeNull())

  it('rejects a number carrying a marker it does not understand', () =>
    // Rejecting loudly beats guessing whether CR means credit here.
    expect(parseSignedDecimal('12.34 CR', usd)).toBeNull())

  it('rejects a minus in the middle', () => expect(parseSignedDecimal('1-2', usd)).toBeNull())

  it('rejects an ambiguous run of separators', () =>
    // With "." as the decimal point, 1.234.567 is not a number. It used to come
    // out as 1234.56.
    expect(parseSignedDecimal('1.234.567', usd)).toBeNull())

  it('rejects parenthesised input when parensNegative is off', () =>
    // The config says parens are not a sign, so this is not a number it can
    // read. Importing it as positive would flip the sign of a real debit.
    expect(parseSignedDecimal('(12.34)', usd)).toBeNull())
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

  it('treats a blank side as zero rather than as missing', () =>
    expect(parseSplitAmount('', '100.00', fmt)).toBe(10000))

  it('rejects the columns being pointed at a date and a narrative', () =>
    // The reported case: this used to import as -12,079,005.00 with a green
    // "ok" badge, because 12082026 - 3021 is arithmetic the parser was happy to
    // do on a date and a shop name.
    expect(parseSplitAmount('12/08/2026', 'WOOLWORTHS 3021 NEWTOWN', fmt)).toBeNull())

  it('rejects a good side paired with a bad one', () =>
    // Silently reading the unparseable side as 0 would let half a wrong mapping
    // through unnoticed.
    expect(parseSplitAmount('84.50', 'WOOLWORTHS 3021 NEWTOWN', fmt)).toBeNull())
})
