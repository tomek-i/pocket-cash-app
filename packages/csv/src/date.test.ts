import { describe, expect, it } from 'vitest'
import { parseDate } from './date'

describe('parseDate', () => {
  it('parses DD/MM/YYYY', () => expect(parseDate('24/06/2026', 'DD/MM/YYYY')).toBe('2026-06-24'))
  it('parses MM/DD/YYYY', () => expect(parseDate('06/24/2026', 'MM/DD/YYYY')).toBe('2026-06-24'))
  it('parses ISO YYYY-MM-DD', () =>
    expect(parseDate('2026-06-24', 'YYYY-MM-DD')).toBe('2026-06-24'))
  it('parses dotted DD.MM.YYYY', () =>
    expect(parseDate('01.02.2026', 'DD.MM.YYYY')).toBe('2026-02-01'))
  it('expands 2-digit year to 2000+', () =>
    expect(parseDate('3/7/26', 'D/M/YY')).toBe('2026-07-03'))
  it('pads single-digit day/month', () =>
    expect(parseDate('1/2/2026', 'D/M/YYYY')).toBe('2026-02-01'))
  it('accepts a leap day', () => expect(parseDate('29/02/2024', 'DD/MM/YYYY')).toBe('2024-02-29'))

  it('rejects an impossible day', () => expect(parseDate('31/02/2026', 'DD/MM/YYYY')).toBeNull())
  it('rejects a non-leap Feb 29', () => expect(parseDate('29/02/2026', 'DD/MM/YYYY')).toBeNull())
  it('rejects a format mismatch', () => expect(parseDate('2026/06/24', 'DD/MM/YYYY')).toBeNull())
  it('rejects empty input', () => expect(parseDate('', 'DD/MM/YYYY')).toBeNull())
})
