/**
 * The generic bracket engine: given a schedule and a value, find the one
 * matching band and work out the amount.
 *
 * This file must stay free of any notion of what the charge is called or which
 * country it belongs to. Feed it a stamp duty table, a land tax table or a
 * registration fee table and it behaves identically.
 */

import type { EngineResult, RateBracket, RateSchedule } from './types'
import { fail, ok } from './types'

/** Everything the UI needs to explain a calculation, in plain numbers. */
export interface BracketBreakdown {
  /** The band that matched. */
  bracket: RateBracket
  /** Its index in `schedule.brackets`. */
  bracketIndex: number
  /** The value the schedule was applied to, minor units. */
  value: number
  /** `bracket.baseAmount`, minor units. */
  baseAmount: number
  /** `bracket.rate`, decimal. */
  rate: number
  /** `value - bracket.minimum`, minor units. */
  amountOverThreshold: number
  /** The part contributed by the rate, minor units. */
  rateAmount: number
  /** Set when `minimumCharge` raised the result. */
  minimumChargeApplied: boolean
  /** The final amount, minor units. */
  total: number
}

/**
 * The band matching `value`. `minimum` inclusive, `maximum` exclusive, so a
 * contiguous schedule has exactly one match.
 *
 * A value below the first bracket's minimum matches nothing, which is a
 * configuration problem rather than a calculation one: schedules are expected to
 * start at 0.
 */
export function resolveBracket(
  schedule: RateSchedule,
  value: number,
): EngineResult<{ bracket: RateBracket; index: number }> {
  if (!Number.isFinite(value)) {
    return fail('VALUE_NOT_FINITE', 'The value to calculate must be a finite number.')
  }
  if (schedule.brackets.length === 0) {
    return fail('NO_BRACKETS', `Rate schedule "${schedule.name}" has no brackets.`)
  }

  for (const [index, bracket] of schedule.brackets.entries()) {
    const aboveMinimum = value >= bracket.minimum
    const belowMaximum = bracket.maximum === null || value < bracket.maximum
    if (aboveMinimum && belowMaximum) return ok({ bracket, index })
  }

  return fail(
    'NO_MATCHING_BRACKET',
    `No bracket in "${schedule.name}" covers ${value}. Check the schedule starts at 0 and ends with an unlimited bracket.`,
  )
}

/** Apply a single bracket to a value. Exported for the validator's probes. */
export function applyBracket(bracket: RateBracket, index: number, value: number): BracketBreakdown {
  const amountOverThreshold = Math.max(0, value - bracket.minimum)

  let rateAmount: number
  switch (bracket.rateUnit) {
    case 'fixed':
      rateAmount = 0
      break
    case 'perUnit': {
      const unitSize = bracket.unitSize && bracket.unitSize > 0 ? bracket.unitSize : 1
      rateAmount = Math.ceil(amountOverThreshold / unitSize) * bracket.rate
      break
    }
    default:
      rateAmount = amountOverThreshold * bracket.rate
  }

  const raw = bracket.baseAmount + rateAmount
  const floored = bracket.minimumCharge ?? 0
  const minimumChargeApplied = raw < floored

  return {
    bracket,
    bracketIndex: index,
    value,
    baseAmount: bracket.baseAmount,
    rate: bracket.rate,
    amountOverThreshold,
    // Rounded so the breakdown adds up to the total the user is shown.
    rateAmount: Math.round(rateAmount),
    minimumChargeApplied,
    total: Math.round(minimumChargeApplied ? floored : raw),
  }
}

/**
 * Calculate the charge for `value` under `schedule`, with the breakdown the
 * "Calculation details" panel renders. Work it out once here rather than
 * recomputing it in a component.
 */
export function calculateBracketed(
  schedule: RateSchedule,
  value: number,
): EngineResult<BracketBreakdown> {
  const resolved = resolveBracket(schedule, value)
  if (!resolved.ok) return resolved
  return ok(applyBracket(resolved.value.bracket, resolved.value.index, value))
}

/** True when `date` (YYYY-MM-DD) falls inside the schedule's effective range. */
export function isEffectiveOn(schedule: RateSchedule, date: string): boolean {
  if (date < schedule.effectiveFrom) return false
  if (schedule.effectiveTo !== null && date > schedule.effectiveTo) return false
  return true
}

export interface SelectScheduleOptions {
  /**
   * Ignore `date` and take the schedule in force today. This backs the
   * "use current rate" convenience toggle.
   */
  useCurrent?: boolean
  /** Today's date as `YYYY-MM-DD`. Injected so tests are not clock-dependent. */
  today?: string
}

/**
 * The schedule for a jurisdiction that applies on a given date.
 *
 * When several match (which the validator should have prevented) the newest
 * `effectiveFrom` wins, then the highest `version`, so a corrected schedule
 * beats the one it replaced.
 */
export function selectSchedule(
  schedules: RateSchedule[],
  jurisdiction: string,
  date: string,
  options: SelectScheduleOptions = {},
): EngineResult<RateSchedule> {
  const on = options.useCurrent ? (options.today ?? new Date().toISOString().slice(0, 10)) : date

  const candidates = schedules
    .filter((s) => s.enabled !== false)
    .filter((s) => s.jurisdiction === jurisdiction)
    .filter((s) => isEffectiveOn(s, on))
    .sort((a, b) =>
      a.effectiveFrom === b.effectiveFrom
        ? b.version - a.version
        : a.effectiveFrom < b.effectiveFrom
          ? 1
          : -1,
    )

  const best = candidates[0]
  if (!best) {
    return fail(
      'NO_EFFECTIVE_SCHEDULE',
      `No enabled rate schedule for ${jurisdiction} is effective on ${on}.`,
    )
  }
  return ok(best)
}
