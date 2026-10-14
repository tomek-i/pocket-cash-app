import { describe, expect, it } from 'vitest'
import { presetFor, presetRange } from './date-presets'

// 14 October 2026, local time.
const today = new Date(2026, 9, 14)

describe('presetRange', () => {
  it('covers the whole of this month', () => {
    expect(presetRange('this-month', today)).toEqual({ from: '2026-10-01', to: '2026-10-31' })
  })

  it('covers the whole of last month, across a year boundary too', () => {
    expect(presetRange('last-month', today)).toEqual({ from: '2026-09-01', to: '2026-09-30' })
    expect(presetRange('last-month', new Date(2026, 0, 10))).toEqual({
      from: '2025-12-01',
      to: '2025-12-31',
    })
  })

  it('covers the financial year that today falls in', () => {
    expect(presetRange('this-fy', today)).toEqual({ from: '2026-07-01', to: '2027-06-30' })
    expect(presetRange('this-fy', new Date(2026, 5, 30))).toEqual({
      from: '2025-07-01',
      to: '2026-06-30',
    })
  })

  it('has no range for any time or a custom range', () => {
    expect(presetRange('any', today)).toBeNull()
    expect(presetRange('custom', today)).toBeNull()
  })
})

describe('presetFor', () => {
  it('recognises a preset from its range', () => {
    expect(presetFor('2026-09-01', '2026-09-30', today)).toBe('last-month')
    expect(presetFor('2026-07-01', '2027-06-30', today)).toBe('this-fy')
  })

  it('calls anything else custom, and no dates any time', () => {
    expect(presetFor('2026-09-03', '2026-09-30', today)).toBe('custom')
    expect(presetFor(undefined, '2026-09-30', today)).toBe('custom')
    expect(presetFor(undefined, undefined, today)).toBe('any')
  })
})
