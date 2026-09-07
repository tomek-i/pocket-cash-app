import { describe, expect, it } from 'vitest'
import { calculateBracketed, isEffectiveOn, resolveBracket, selectSchedule } from './brackets'
import type { RateSchedule } from './types'

/** A deliberately non-Australian schedule, to prove the engine is generic. */
const flatFee: RateSchedule = {
  id: 'test-flat',
  name: 'Test Flat Fee',
  jurisdiction: 'XX-TEST',
  country: 'XX',
  region: 'TEST',
  currency: 'USD',
  effectiveFrom: '2020-01-01',
  effectiveTo: null,
  calculationType: 'bracketed',
  version: 1,
  brackets: [
    { minimum: 0, maximum: 100_00, baseAmount: 5_00, rate: 0, rateUnit: 'fixed' },
    { minimum: 100_00, maximum: null, baseAmount: 10_00, rate: 0, rateUnit: 'fixed' },
  ],
}

const perUnit: RateSchedule = {
  ...flatFee,
  id: 'test-per-unit',
  name: 'Test Per Unit',
  // $3 for every $100 (or part thereof) above zero.
  brackets: [
    {
      minimum: 0,
      maximum: null,
      baseAmount: 0,
      rate: 3_00,
      rateUnit: 'perUnit',
      unitSize: 100_00,
    },
  ],
}

describe('resolveBracket', () => {
  it('matches the first bracket at its minimum', () => {
    const result = resolveBracket(flatFee, 0)
    expect(result.ok && result.value.index).toBe(0)
  })

  it('treats the maximum as exclusive, so the boundary belongs to the next bracket', () => {
    const below = resolveBracket(flatFee, 99_99)
    const at = resolveBracket(flatFee, 100_00)
    expect(below.ok && below.value.index).toBe(0)
    expect(at.ok && at.value.index).toBe(1)
  })

  it('matches the unlimited bracket for a very large value', () => {
    const result = resolveBracket(flatFee, 1_000_000_000_00)
    expect(result.ok && result.value.index).toBe(1)
  })

  it('fails when no bracket covers the value', () => {
    const gapped: RateSchedule = {
      ...flatFee,
      brackets: [{ minimum: 500_00, maximum: null, baseAmount: 0, rate: 0, rateUnit: 'fixed' }],
    }
    const result = resolveBracket(gapped, 100)
    expect(result.ok).toBe(false)
    expect(!result.ok && result.error.code).toBe('NO_MATCHING_BRACKET')
  })

  it('fails on an empty schedule', () => {
    const result = resolveBracket({ ...flatFee, brackets: [] }, 100)
    expect(!result.ok && result.error.code).toBe('NO_BRACKETS')
  })

  it('fails on a non-finite value', () => {
    const result = resolveBracket(flatFee, Number.NaN)
    expect(!result.ok && result.error.code).toBe('VALUE_NOT_FINITE')
  })
})

describe('calculateBracketed', () => {
  it('charges a flat fee bracket without applying the rate', () => {
    const result = calculateBracketed(flatFee, 50_00)
    expect(result.ok && result.value.total).toBe(5_00)
    expect(result.ok && result.value.amountOverThreshold).toBe(50_00)
    expect(result.ok && result.value.rateAmount).toBe(0)
  })

  it('rounds a per-unit bracket up to the whole unit', () => {
    // $250 above zero is three whole $100 units, so $9.
    const result = calculateBracketed(perUnit, 250_00)
    expect(result.ok && result.value.total).toBe(9_00)
  })

  it('applies a minimum charge when the calculated amount falls short', () => {
    const floored: RateSchedule = {
      ...flatFee,
      brackets: [
        {
          minimum: 0,
          maximum: null,
          baseAmount: 0,
          rate: 0.01,
          rateUnit: 'percentage',
          minimumCharge: 50_00,
        },
      ],
    }
    const small = calculateBracketed(floored, 100_00)
    const large = calculateBracketed(floored, 100_000_00)
    expect(small.ok && small.value.total).toBe(50_00)
    expect(small.ok && small.value.minimumChargeApplied).toBe(true)
    expect(large.ok && large.value.total).toBe(1_000_00)
    expect(large.ok && large.value.minimumChargeApplied).toBe(false)
  })

  it('returns a breakdown that adds up', () => {
    const percentage: RateSchedule = {
      ...flatFee,
      brackets: [
        { minimum: 0, maximum: 100_00, baseAmount: 0, rate: 0, rateUnit: 'fixed' },
        { minimum: 100_00, maximum: null, baseAmount: 20_00, rate: 0.05, rateUnit: 'percentage' },
      ],
    }
    const result = calculateBracketed(percentage, 300_00)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.baseAmount).toBe(20_00)
    expect(result.value.amountOverThreshold).toBe(200_00)
    expect(result.value.rateAmount).toBe(10_00)
    expect(result.value.baseAmount + result.value.rateAmount).toBe(result.value.total)
  })
})

describe('isEffectiveOn', () => {
  const dated: RateSchedule = { ...flatFee, effectiveFrom: '2026-07-01', effectiveTo: '2027-06-30' }

  it('includes both ends of the range', () => {
    expect(isEffectiveOn(dated, '2026-07-01')).toBe(true)
    expect(isEffectiveOn(dated, '2027-06-30')).toBe(true)
  })

  it('excludes dates outside the range', () => {
    expect(isEffectiveOn(dated, '2026-06-30')).toBe(false)
    expect(isEffectiveOn(dated, '2027-07-01')).toBe(false)
  })

  it('treats a null end date as open ended', () => {
    expect(isEffectiveOn({ ...dated, effectiveTo: null }, '2099-01-01')).toBe(true)
  })
})

describe('selectSchedule', () => {
  const y2025: RateSchedule = {
    ...flatFee,
    id: '2025',
    effectiveFrom: '2025-07-01',
    effectiveTo: '2026-06-30',
  }
  const y2026: RateSchedule = {
    ...flatFee,
    id: '2026',
    effectiveFrom: '2026-07-01',
    effectiveTo: '2027-06-30',
  }
  const schedules = [y2025, y2026]

  it('picks the schedule effective on the purchase date', () => {
    const result = selectSchedule(schedules, 'XX-TEST', '2026-08-15')
    expect(result.ok && result.value.id).toBe('2026')
  })

  it('keeps using the historical schedule for an older date', () => {
    const result = selectSchedule(schedules, 'XX-TEST', '2025-09-01')
    expect(result.ok && result.value.id).toBe('2025')
  })

  it('ignores the date when asked for the current rate', () => {
    const result = selectSchedule(schedules, 'XX-TEST', '2025-09-01', {
      useCurrent: true,
      today: '2026-08-15',
    })
    expect(result.ok && result.value.id).toBe('2026')
  })

  it('ignores schedules from another jurisdiction', () => {
    const result = selectSchedule(schedules, 'YY-OTHER', '2026-08-15')
    expect(!result.ok && result.error.code).toBe('NO_EFFECTIVE_SCHEDULE')
  })

  it('ignores disabled schedules', () => {
    const result = selectSchedule([{ ...y2026, enabled: false }], 'XX-TEST', '2026-08-15')
    expect(result.ok).toBe(false)
  })

  it('prefers the higher version when two schedules share a start date', () => {
    const corrected: RateSchedule = { ...y2026, id: '2026-v2', version: 2 }
    const result = selectSchedule([y2026, corrected], 'XX-TEST', '2026-08-15')
    expect(result.ok && result.value.id).toBe('2026-v2')
  })
})
