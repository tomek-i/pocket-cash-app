import { describe, expect, it } from 'vitest'
import { hiddenSummary, isAlreadyTracked } from './detection'

describe('isAlreadyTracked', () => {
  it('matches a differently cased name', () => {
    expect(isAlreadyTracked('fitlife gym', [{ name: 'FitLife Gym', matcher: null }])).toBe(true)
  })

  it('matches a shorter matcher inside the detection', () => {
    expect(isAlreadyTracked('fitlife gym', [{ name: 'Gym', matcher: 'fitlife' }])).toBe(true)
  })

  it('matches a detection shorter than the tracked name', () => {
    expect(isAlreadyTracked('netflix', [{ name: 'Netflix Premium', matcher: null }])).toBe(true)
  })

  it('compares whole words only', () => {
    expect(isAlreadyTracked('spotify', [{ name: 'Spot', matcher: null }])).toBe(false)
  })

  it('ignores very short names', () => {
    expect(isAlreadyTracked('tv licence', [{ name: 'TV', matcher: null }])).toBe(false)
  })

  it('does not match unrelated subscriptions', () => {
    expect(isAlreadyTracked('disney plus', [{ name: 'Netflix', matcher: 'netflix' }])).toBe(false)
  })
})

describe('hiddenSummary', () => {
  it('says nothing when nothing was hidden', () => {
    expect(hiddenSummary({ tracked: 0, dismissed: 0, transfers: 0 })).toBeNull()
  })

  it('lists each reason that applies', () => {
    expect(hiddenSummary({ tracked: 1, dismissed: 0, transfers: 2 })).toBe(
      '3 hidden: already tracked, or a transfer between your accounts.',
    )
    expect(hiddenSummary({ tracked: 0, dismissed: 1, transfers: 0 })).toBe(
      '1 hidden: marked as not a subscription.',
    )
  })
})
