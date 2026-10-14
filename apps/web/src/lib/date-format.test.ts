import { describe, expect, it } from 'vitest'
import { formatDate, formatMonth } from './date-format'

const today = new Date(2026, 9, 14)

describe('formatDate', () => {
  it('drops the year when it is the current one', () => {
    expect(formatDate('2026-08-12', 'en-AU', { today })).toBe('12 Aug')
  })

  it('keeps the year for any other year', () => {
    expect(formatDate('2025-12-12', 'en-AU', { today })).toBe('12 Dec 2025')
  })

  it('follows the locale', () => {
    expect(formatDate('2026-08-12', 'en-US', { today })).toBe('Aug 12')
    expect(formatDate('2026-08-12', 'de-DE', { today })).toBe('12. Aug.')
  })

  it('can always show the year', () => {
    expect(formatDate('2026-03-01', 'en-AU', { today, alwaysYear: true })).toBe('1 Mar 2026')
  })

  it('never shifts a day with the time zone', () => {
    expect(formatDate('2026-01-01', 'en-AU', { today })).toBe('1 Jan')
  })

  it('leaves anything that is not a date alone', () => {
    expect(formatDate('not a date', 'en-AU', { today })).toBe('not a date')
  })
})

describe('formatMonth', () => {
  it('names a month in the locale', () => {
    expect(formatMonth('2026-10', 'en-AU')).toBe('October 2026')
    expect(formatMonth('2026-10', 'en-AU', 'short')).toBe('Oct')
  })
})
