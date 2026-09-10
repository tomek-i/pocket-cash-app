import { describe, expect, it } from 'vitest'
import {
  caretAfterDigits,
  digitsBefore,
  formatPlaceholder,
  formatTypedAmount,
  fromCanonicalAmount,
  getSeparators,
  toCanonicalAmount,
} from './number-format'

// A locale whose separators are the reverse of English, which is where an
// assumption about commas and dots turns into a wrong number rather than an
// ugly one.
const DE = 'de-DE'
const EN = 'en-AU'

describe('getSeparators', () => {
  it('reads English separators', () => {
    expect(getSeparators(EN)).toEqual({ group: ',', decimal: '.' })
  })

  it('reads reversed separators', () => {
    expect(getSeparators(DE)).toEqual({ group: '.', decimal: ',' })
  })
})

describe('formatTypedAmount', () => {
  it('groups as the user types', () => {
    expect(formatTypedAmount('450000', EN)).toBe('450,000')
    expect(formatTypedAmount('45000', EN)).toBe('45,000')
    expect(formatTypedAmount('4500', EN)).toBe('4,500')
    expect(formatTypedAmount('450', EN)).toBe('450')
  })

  it('groups millions', () => {
    expect(formatTypedAmount('1200000', EN)).toBe('1,200,000')
  })

  it('keeps a trailing decimal separator so it can be typed through', () => {
    expect(formatTypedAmount('450000.', EN)).toBe('450,000.')
  })

  it('keeps decimals, capped at two', () => {
    expect(formatTypedAmount('450000.5', EN)).toBe('450,000.5')
    expect(formatTypedAmount('450000.567', EN)).toBe('450,000.56')
  })

  it('ignores separators the user typed', () => {
    expect(formatTypedAmount('450,000', EN)).toBe('450,000')
    expect(formatTypedAmount('$450,000.50', EN)).toBe('450,000.50')
  })

  it('stays empty for empty input rather than showing a zero', () => {
    expect(formatTypedAmount('', EN)).toBe('')
    expect(formatTypedAmount('abc', EN)).toBe('')
  })

  it('uses the locale separators', () => {
    expect(formatTypedAmount('450000', DE)).toBe('450.000')
    expect(formatTypedAmount('450000,5', DE)).toBe('450.000,5')
  })
})

describe('toCanonicalAmount', () => {
  it('submits a plain number whatever the display', () => {
    expect(toCanonicalAmount('450,000', EN)).toBe('450000')
    expect(toCanonicalAmount('450,000.50', EN)).toBe('450000.50')
  })

  it('reads a reversed locale correctly', () => {
    // The bug this exists to prevent: parseFloat on this string gives 450.
    expect(toCanonicalAmount('450.000,50', DE)).toBe('450000.50')
    expect(toCanonicalAmount('450.000', DE)).toBe('450000')
  })

  it('drops a trailing separator', () => {
    expect(toCanonicalAmount('450,000.', EN)).toBe('450000')
  })

  it('handles a leading decimal', () => {
    expect(toCanonicalAmount('.5', EN)).toBe('0.5')
  })

  it('is empty for empty input', () => {
    expect(toCanonicalAmount('', EN)).toBe('')
    expect(toCanonicalAmount('abc', EN)).toBe('')
  })

  it('round-trips through the display format', () => {
    for (const value of ['0', '5', '450000', '450000.50', '1200000.05']) {
      expect(toCanonicalAmount(fromCanonicalAmount(value, EN), EN)).toBe(value)
      expect(toCanonicalAmount(fromCanonicalAmount(value, DE), DE)).toBe(value)
    }
  })
})

describe('fromCanonicalAmount', () => {
  it('groups a stored value for display', () => {
    expect(fromCanonicalAmount('450000', EN)).toBe('450,000')
    expect(fromCanonicalAmount('450000.5', EN)).toBe('450,000.5')
    expect(fromCanonicalAmount('450000', DE)).toBe('450.000')
  })

  it('stays empty for an empty value', () => {
    expect(fromCanonicalAmount('', EN)).toBe('')
  })
})

describe('caret handling', () => {
  it('counts the digits before a caret, ignoring separators', () => {
    expect(digitsBefore('450,000', 7)).toBe(6)
    expect(digitsBefore('450,000', 3)).toBe(3)
    expect(digitsBefore('450,000', 4)).toBe(3)
  })

  it('finds the position after a number of digits', () => {
    expect(caretAfterDigits('450,000', 6)).toBe(7)
    expect(caretAfterDigits('450,000', 3)).toBe(3)
    expect(caretAfterDigits('4,500', 1)).toBe(1)
  })

  it('keeps the caret in place across a reformat', () => {
    // Typing "0" at the end of "45,000" gives "450,000": the caret was after
    // 5 digits and must land after 6, which is position 7 rather than 6.
    const before = '45,0000'
    const caret = 7
    const digits = digitsBefore(before, caret)
    const after = formatTypedAmount(before, EN)
    expect(after).toBe('450,000')
    expect(caretAfterDigits(after, digits)).toBe(7)
  })

  it('keeps the caret when editing mid-number', () => {
    // Caret sits after "450" in "450,000"; a reformat must not move it.
    const digits = digitsBefore('450,000', 3)
    expect(caretAfterDigits('450,000', digits)).toBe(3)
  })

  it('sits before the first digit when there are none behind the caret', () => {
    expect(caretAfterDigits('450,000', 0)).toBe(0)
  })
})

describe('formatPlaceholder', () => {
  it('formats an example for the placeholder', () => {
    expect(formatPlaceholder(450000, EN)).toBe('450,000')
    expect(formatPlaceholder(450000, DE)).toBe('450.000')
  })
})
