/**
 * The seeded NSW schedule checked against the published table.
 *
 * Every threshold is probed just below, exactly at and just above, plus a very
 * large value, because a boundary that is off by one minor unit produces a
 * plausible looking number that nobody notices.
 *
 * Amounts below are written in minor units with underscores as
 * `dollars_cents`, so `39_187_00` reads as $39,187.00.
 */

import { describe, expect, it } from 'vitest'
import { calculateBracketed } from '../brackets'
import { probeRateSchedule, validateRateSchedule } from '../validate'
import { NSW_TRANSFER_DUTY_2026_27 } from './rate-schedules'

const schedule = NSW_TRANSFER_DUTY_2026_27

/** Duty for a dutiable value, both in minor units. */
function duty(dutiableValue: number): number {
  const result = calculateBracketed(schedule, dutiableValue)
  if (!result.ok) throw new Error(result.error.message)
  return result.value.total
}

describe('NSW transfer duty 2026/27', () => {
  it('is a valid schedule', () => {
    const result = validateRateSchedule(schedule)
    expect(result.issues.filter((issue) => issue.severity === 'error')).toEqual([])
    expect(result.valid).toBe(true)
  })

  it('charges the documented duty on a $1,000,000 dutiable value', () => {
    expect(duty(1_000_000_00)).toBe(39_187_00)
  })

  describe('bracket 1, up to $18,000 at 1.25%', () => {
    it('charges nothing on zero', () => expect(duty(0)).toBe(0))
    it('charges 1.25% just above zero', () => expect(duty(1_00)).toBe(1))
    it('charges 1.25% inside the bracket', () => expect(duty(10_000_00)).toBe(125_00))
    it('charges $224.99 just below the threshold', () => expect(duty(17_999_00)).toBe(224_99))
  })

  describe('bracket 2, $18,000 to $38,000', () => {
    it('charges the $225 base exactly at the threshold', () => expect(duty(18_000_00)).toBe(225_00))
    it('adds 1.5% above the threshold', () => expect(duty(19_000_00)).toBe(240_00))
    it('meets the next base at the top of the bracket', () => expect(duty(38_000_00)).toBe(525_00))
  })

  describe('bracket 3, $38,000 to $103,000', () => {
    it('charges the $525 base exactly at the threshold', () => expect(duty(38_000_00)).toBe(525_00))
    it('adds 1.75% above the threshold', () => expect(duty(50_000_00)).toBe(735_00))
  })

  describe('bracket 4, $103,000 to $387,000', () => {
    it('charges the $1,662 base exactly at the threshold', () =>
      expect(duty(103_000_00)).toBe(1_662_00))
    it('adds 3.5% above the threshold', () => expect(duty(200_000_00)).toBe(5_057_00))
    it('meets the next base at the top of the bracket', () =>
      expect(duty(387_000_00)).toBe(11_602_00))
  })

  describe('bracket 5, $387,000 to $1,290,000', () => {
    it('charges the $11,602 base exactly at the threshold', () =>
      expect(duty(387_000_00)).toBe(11_602_00))
    it('adds 4.5% above the threshold', () => expect(duty(500_000_00)).toBe(16_687_00))
    it('meets the next base at the top of the bracket', () =>
      expect(duty(1_290_000_00)).toBe(52_237_00))
  })

  describe('bracket 6, above $1,290,000', () => {
    it('charges the $52,237 base exactly at the threshold', () =>
      expect(duty(1_290_000_00)).toBe(52_237_00))
    it('adds 5.5% above the threshold', () => expect(duty(2_000_000_00)).toBe(91_287_00))
    it('handles a very large value', () => expect(duty(10_000_000_00)).toBe(531_287_00))
  })

  it('steps by 50 cents at $103,000, exactly as the published table does', () => {
    // The lower band reaches $1,662.50 while the next band's published base is
    // $1,662. Duty is charged in whole dollars, so the table is reproduced
    // rather than smoothed. Documented here so it is not "fixed" later.
    expect(duty(102_999_00)).toBe(1_662_48)
    expect(duty(103_000_00)).toBe(1_662_00)
  })

  it('shows a breakdown matching the published worked example', () => {
    const result = calculateBracketed(schedule, 1_000_000_00)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.bracketIndex).toBe(4)
    expect(result.value.baseAmount).toBe(11_602_00)
    expect(result.value.rate).toBe(0.045)
    expect(result.value.amountOverThreshold).toBe(613_000_00)
    expect(result.value.rateAmount).toBe(27_585_00)
    expect(result.value.total).toBe(39_187_00)
  })

  it('probes every boundary without an unmatched value', () => {
    const probes = probeRateSchedule(schedule)
    expect(probes.length).toBeGreaterThan(0)
    expect(probes.every((probe) => probe.bracketIndex !== null)).toBe(true)
    expect(probes.at(-1)?.label).toBe('Very large value')
  })
})
