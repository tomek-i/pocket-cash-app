import { describe, expect, it } from 'vitest'
import type { RateBracket, RateSchedule } from './types'
import { probeRateSchedule, validateRateSchedule, validateScheduleSet } from './validate'

function schedule(brackets: RateBracket[], overrides: Partial<RateSchedule> = {}): RateSchedule {
  return {
    id: 'test',
    name: 'Test Schedule',
    jurisdiction: 'XX-TEST',
    country: 'XX',
    region: 'TEST',
    currency: 'USD',
    effectiveFrom: '2026-01-01',
    effectiveTo: null,
    calculationType: 'bracketed',
    version: 1,
    brackets,
    ...overrides,
  }
}

const valid: RateBracket[] = [
  { minimum: 0, maximum: 100_00, baseAmount: 0, rate: 0.01, rateUnit: 'percentage' },
  { minimum: 100_00, maximum: 500_00, baseAmount: 1_00, rate: 0.02, rateUnit: 'percentage' },
  { minimum: 500_00, maximum: null, baseAmount: 9_00, rate: 0.03, rateUnit: 'percentage' },
]

function codes(result: ReturnType<typeof validateRateSchedule>): string[] {
  return result.issues.map((issue) => issue.code)
}

describe('validateRateSchedule', () => {
  it('accepts a well-formed schedule', () => {
    const result = validateRateSchedule(schedule(valid))
    expect(result.valid).toBe(true)
    expect(result.issues).toEqual([])
  })

  it('rejects an empty schedule', () => {
    expect(codes(validateRateSchedule(schedule([])))).toContain('NO_BRACKETS')
  })

  it('rejects a negative minimum', () => {
    const brackets: RateBracket[] = [
      { minimum: -1, maximum: null, baseAmount: 0, rate: 0.01, rateUnit: 'percentage' },
    ]
    expect(codes(validateRateSchedule(schedule(brackets)))).toContain('NEGATIVE_MINIMUM')
  })

  it('rejects a negative rate', () => {
    const brackets: RateBracket[] = [
      { minimum: 0, maximum: null, baseAmount: 0, rate: -0.01, rateUnit: 'percentage' },
    ]
    expect(codes(validateRateSchedule(schedule(brackets)))).toContain('NEGATIVE_RATE')
  })

  it('rejects a negative base amount', () => {
    const brackets: RateBracket[] = [
      { minimum: 0, maximum: null, baseAmount: -1, rate: 0.01, rateUnit: 'percentage' },
    ]
    expect(codes(validateRateSchedule(schedule(brackets)))).toContain('NEGATIVE_BASE')
  })

  it('rejects a maximum that is not above the minimum', () => {
    const brackets: RateBracket[] = [
      { minimum: 0, maximum: 100_00, baseAmount: 0, rate: 0.01, rateUnit: 'percentage' },
      { minimum: 100_00, maximum: 100_00, baseAmount: 0, rate: 0.02, rateUnit: 'percentage' },
      { minimum: 100_00, maximum: null, baseAmount: 0, rate: 0.03, rateUnit: 'percentage' },
    ]
    expect(codes(validateRateSchedule(schedule(brackets)))).toContain('MAXIMUM_NOT_ABOVE_MINIMUM')
  })

  it('rejects overlapping brackets', () => {
    const brackets: RateBracket[] = [
      { minimum: 0, maximum: 200_00, baseAmount: 0, rate: 0.01, rateUnit: 'percentage' },
      { minimum: 100_00, maximum: null, baseAmount: 0, rate: 0.02, rateUnit: 'percentage' },
    ]
    expect(codes(validateRateSchedule(schedule(brackets)))).toContain('BRACKETS_OVERLAP')
  })

  it('rejects a gap between brackets', () => {
    const brackets: RateBracket[] = [
      { minimum: 0, maximum: 100_00, baseAmount: 0, rate: 0.01, rateUnit: 'percentage' },
      { minimum: 200_00, maximum: null, baseAmount: 0, rate: 0.02, rateUnit: 'percentage' },
    ]
    expect(codes(validateRateSchedule(schedule(brackets)))).toContain('BRACKETS_NOT_CONTIGUOUS')
  })

  it('rejects a schedule that does not start at zero', () => {
    const brackets: RateBracket[] = [
      { minimum: 100_00, maximum: null, baseAmount: 0, rate: 0.01, rateUnit: 'percentage' },
    ]
    expect(codes(validateRateSchedule(schedule(brackets)))).toContain('DOES_NOT_START_AT_ZERO')
  })

  it('rejects a schedule with no unlimited bracket', () => {
    const brackets: RateBracket[] = [
      { minimum: 0, maximum: 100_00, baseAmount: 0, rate: 0.01, rateUnit: 'percentage' },
    ]
    expect(codes(validateRateSchedule(schedule(brackets)))).toContain('NO_UNLIMITED_BRACKET')
  })

  it('rejects more than one unlimited bracket', () => {
    const brackets: RateBracket[] = [
      { minimum: 0, maximum: null, baseAmount: 0, rate: 0.01, rateUnit: 'percentage' },
      { minimum: 100_00, maximum: null, baseAmount: 0, rate: 0.02, rateUnit: 'percentage' },
    ]
    expect(codes(validateRateSchedule(schedule(brackets)))).toContain('MULTIPLE_UNLIMITED_BRACKETS')
  })

  it('rejects an unlimited bracket that is not last', () => {
    const brackets: RateBracket[] = [
      { minimum: 0, maximum: null, baseAmount: 0, rate: 0.01, rateUnit: 'percentage' },
      { minimum: 100_00, maximum: 200_00, baseAmount: 0, rate: 0.02, rateUnit: 'percentage' },
    ]
    expect(codes(validateRateSchedule(schedule(brackets)))).toContain('UNLIMITED_BRACKET_NOT_LAST')
  })

  it('rejects brackets that are out of order', () => {
    const brackets: RateBracket[] = [
      { minimum: 100_00, maximum: 200_00, baseAmount: 0, rate: 0.01, rateUnit: 'percentage' },
      { minimum: 0, maximum: null, baseAmount: 0, rate: 0.02, rateUnit: 'percentage' },
    ]
    expect(codes(validateRateSchedule(schedule(brackets)))).toContain('BRACKETS_OUT_OF_ORDER')
  })

  it('requires a currency', () => {
    expect(codes(validateRateSchedule(schedule(valid, { currency: '  ' })))).toContain(
      'CURRENCY_REQUIRED',
    )
  })

  it('requires a jurisdiction', () => {
    expect(codes(validateRateSchedule(schedule(valid, { jurisdiction: '' })))).toContain(
      'JURISDICTION_REQUIRED',
    )
  })

  it('rejects an effective range that runs backwards', () => {
    const dated = schedule(valid, { effectiveFrom: '2027-01-01', effectiveTo: '2026-01-01' })
    expect(codes(validateRateSchedule(dated))).toContain('DATES_REVERSED')
  })

  it('rejects a per-unit bracket with no unit size', () => {
    const brackets: RateBracket[] = [
      { minimum: 0, maximum: null, baseAmount: 0, rate: 3_00, rateUnit: 'perUnit', unitSize: 0 },
    ]
    expect(codes(validateRateSchedule(schedule(brackets)))).toContain('BAD_UNIT_SIZE')
  })

  it('warns, but does not fail, on a rate above 100%', () => {
    const brackets: RateBracket[] = [
      { minimum: 0, maximum: null, baseAmount: 0, rate: 4.5, rateUnit: 'percentage' },
    ]
    const result = validateRateSchedule(schedule(brackets))
    expect(codes(result)).toContain('RATE_ABOVE_100_PERCENT')
    expect(result.valid).toBe(true)
  })

  it('accepts a schedule with many brackets, since bracket counts vary by jurisdiction', () => {
    const many: RateBracket[] = Array.from({ length: 20 }, (_, index) => ({
      minimum: index * 100_00,
      maximum: index === 19 ? null : (index + 1) * 100_00,
      baseAmount: index * 1_00,
      rate: 0.01,
      rateUnit: 'percentage' as const,
    }))
    expect(validateRateSchedule(schedule(many)).valid).toBe(true)
  })
})

describe('validateScheduleSet', () => {
  const a = schedule(valid, { id: 'a', effectiveFrom: '2026-01-01', effectiveTo: '2026-12-31' })

  it('accepts schedules that do not overlap', () => {
    const b = schedule(valid, { id: 'b', effectiveFrom: '2027-01-01', effectiveTo: '2027-12-31' })
    expect(validateScheduleSet([a, b]).valid).toBe(true)
  })

  it('rejects two schedules effective at the same time for one jurisdiction', () => {
    const b = schedule(valid, { id: 'b', effectiveFrom: '2026-06-01', effectiveTo: '2027-05-31' })
    const result = validateScheduleSet([a, b])
    expect(result.valid).toBe(false)
    expect(result.issues[0]?.code).toBe('AMBIGUOUS_EFFECTIVE_DATES')
  })

  it('allows overlapping dates in different jurisdictions', () => {
    const b = schedule(valid, { id: 'b', jurisdiction: 'YY-OTHER' })
    expect(validateScheduleSet([a, b]).valid).toBe(true)
  })

  it('ignores disabled schedules', () => {
    const b = schedule(valid, { id: 'b', effectiveFrom: '2026-06-01', enabled: false })
    expect(validateScheduleSet([a, b]).valid).toBe(true)
  })
})

describe('probeRateSchedule', () => {
  const probes = probeRateSchedule(schedule(valid))

  it('probes each threshold from both sides', () => {
    const values = probes.map((probe) => probe.value)
    expect(values).toContain(99_99)
    expect(values).toContain(100_00)
    expect(values).toContain(100_01)
  })

  it('probes zero and a very large value', () => {
    expect(probes[0]?.value).toBe(0)
    expect(probes.at(-1)?.label).toBe('Very large value')
  })

  it('returns probes in ascending order', () => {
    const values = probes.map((probe) => probe.value)
    expect(values).toEqual([...values].sort((a, b) => a - b))
  })

  it('marks a value no bracket covers, rather than silently charging zero', () => {
    const gapped = schedule([
      { minimum: 0, maximum: 100_00, baseAmount: 0, rate: 0.01, rateUnit: 'percentage' },
      { minimum: 200_00, maximum: null, baseAmount: 0, rate: 0.02, rateUnit: 'percentage' },
    ])
    const uncovered = probeRateSchedule(gapped).filter((probe) => probe.bracketIndex === null)
    expect(uncovered.length).toBeGreaterThan(0)
    expect(uncovered.every((probe) => probe.amount === null)).toBe(true)
  })
})
