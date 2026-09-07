/**
 * Rate schedule validation and boundary probing.
 *
 * A badly built schedule is silently wrong rather than loudly broken: it still
 * returns a number, just the wrong one. So the settings UI blocks saving on any
 * error here, and shows the probe table so a human can check the result against
 * the jurisdiction's published figures.
 */

import { applyBracket, isEffectiveOn } from './brackets'
import type { RateSchedule } from './types'

export type ValidationSeverity = 'error' | 'warning'

export interface ValidationIssue {
  code: string
  message: string
  severity: ValidationSeverity
  /** Index into `schedule.brackets`, when the issue belongs to one bracket. */
  bracketIndex?: number
}

export interface ValidationResult {
  valid: boolean
  issues: ValidationIssue[]
}

function error(code: string, message: string, bracketIndex?: number): ValidationIssue {
  return { code, message, severity: 'error', bracketIndex }
}

function warning(code: string, message: string, bracketIndex?: number): ValidationIssue {
  return { code, message, severity: 'warning', bracketIndex }
}

/**
 * Check one schedule in isolation. Cross-schedule date clashes need the sibling
 * schedules, so those live in {@link validateScheduleSet}.
 */
export function validateRateSchedule(schedule: RateSchedule): ValidationResult {
  const issues: ValidationIssue[] = []

  if (!schedule.currency.trim()) {
    issues.push(error('CURRENCY_REQUIRED', 'A currency must be set on the schedule.'))
  }
  if (!schedule.jurisdiction.trim()) {
    issues.push(error('JURISDICTION_REQUIRED', 'A jurisdiction must be set on the schedule.'))
  }
  if (schedule.effectiveTo !== null && schedule.effectiveTo < schedule.effectiveFrom) {
    issues.push(error('DATES_REVERSED', 'The effective to date is before the effective from date.'))
  }

  const brackets = schedule.brackets
  if (brackets.length === 0) {
    issues.push(error('NO_BRACKETS', 'A schedule needs at least one bracket.'))
    return { valid: false, issues }
  }

  brackets.forEach((bracket, index) => {
    if (bracket.minimum < 0) {
      issues.push(error('NEGATIVE_MINIMUM', 'A bracket minimum cannot be negative.', index))
    }
    if (bracket.rate < 0) {
      issues.push(error('NEGATIVE_RATE', 'A bracket rate cannot be negative.', index))
    }
    if (bracket.baseAmount < 0) {
      issues.push(error('NEGATIVE_BASE', 'A bracket base amount cannot be negative.', index))
    }
    if (bracket.maximum !== null && bracket.maximum <= bracket.minimum) {
      issues.push(
        error('MAXIMUM_NOT_ABOVE_MINIMUM', 'A bracket maximum must be above its minimum.', index),
      )
    }
    if (bracket.rateUnit === 'perUnit' && (bracket.unitSize ?? 1) <= 0) {
      issues.push(error('BAD_UNIT_SIZE', 'A per-unit bracket needs a unit size above zero.', index))
    }
    if (bracket.rate > 1) {
      issues.push(
        warning(
          'RATE_ABOVE_100_PERCENT',
          'This rate is above 100%. Rates are decimals, so 4.5% is 0.045.',
          index,
        ),
      )
    }
  })

  const first = brackets[0]
  if (first && first.minimum !== 0) {
    issues.push(
      error(
        'DOES_NOT_START_AT_ZERO',
        'The first bracket must start at 0 so every value matches.',
        0,
      ),
    )
  }

  // Exactly one unlimited bracket, and it must be last. Without this a large
  // value silently falls through and the cost reads as an error.
  const unlimited = brackets
    .map((bracket, index) => ({ bracket, index }))
    .filter((entry) => entry.bracket.maximum === null)

  if (unlimited.length === 0) {
    issues.push(
      error('NO_UNLIMITED_BRACKET', 'The final bracket must be marked unlimited (no maximum).'),
    )
  } else if (unlimited.length > 1) {
    issues.push(error('MULTIPLE_UNLIMITED_BRACKETS', 'Only the final bracket may be unlimited.'))
  } else if (unlimited[0]?.index !== brackets.length - 1) {
    issues.push(
      error(
        'UNLIMITED_BRACKET_NOT_LAST',
        'The unlimited bracket must be the last one.',
        unlimited[0]?.index,
      ),
    )
  }

  // Ordering, overlap and gaps. `maximum` is exclusive, so contiguous means the
  // next minimum equals this maximum exactly.
  for (let i = 0; i < brackets.length - 1; i += 1) {
    const current = brackets[i]
    const next = brackets[i + 1]
    if (!current || !next) continue

    if (next.minimum < current.minimum) {
      issues.push(error('BRACKETS_OUT_OF_ORDER', 'Brackets must be ordered by minimum.', i + 1))
      continue
    }
    if (current.maximum === null) continue

    if (next.minimum < current.maximum) {
      issues.push(error('BRACKETS_OVERLAP', 'This bracket overlaps the one before it.', i + 1))
    } else if (next.minimum > current.maximum) {
      issues.push(
        error(
          'BRACKETS_NOT_CONTIGUOUS',
          'There is a gap between this bracket and the one before it.',
          i + 1,
        ),
      )
    }
  }

  return { valid: !issues.some((issue) => issue.severity === 'error'), issues }
}

/**
 * Check a jurisdiction's schedules against each other. Two enabled schedules
 * effective on the same day make the calculation ambiguous, which is the kind of
 * mistake that only shows up months later on one specific purchase date.
 */
export function validateScheduleSet(schedules: RateSchedule[]): ValidationResult {
  const issues: ValidationIssue[] = []
  const enabled = schedules.filter((schedule) => schedule.enabled !== false)

  for (let i = 0; i < enabled.length; i += 1) {
    for (let j = i + 1; j < enabled.length; j += 1) {
      const a = enabled[i]
      const b = enabled[j]
      if (!a || !b) continue
      if (a.jurisdiction !== b.jurisdiction) continue

      const overlaps = isEffectiveOn(a, b.effectiveFrom) || isEffectiveOn(b, a.effectiveFrom)
      if (overlaps) {
        issues.push(
          error(
            'AMBIGUOUS_EFFECTIVE_DATES',
            `"${a.name}" and "${b.name}" are both effective for ${a.jurisdiction} at the same time.`,
          ),
        )
      }
    }
  }

  return { valid: issues.length === 0, issues }
}

export interface BoundaryProbe {
  /** What this probe is checking, for the settings table. */
  label: string
  /** The value probed, minor units. */
  value: number
  /** The bracket that matched, or `null` when none did. */
  bracketIndex: number | null
  /** The calculated amount, minor units, or `null` when no bracket matched. */
  amount: number | null
}

/**
 * Evaluate the schedule at every interesting value: zero, each threshold, one
 * minor unit either side of it, and a very large value. The settings UI shows
 * this so a user can compare it against the published table before saving,
 * which catches an off-by-one boundary far better than a rule ever will.
 */
export function probeRateSchedule(schedule: RateSchedule): BoundaryProbe[] {
  const values = new Map<number, string>()

  const add = (value: number, label: string) => {
    if (value < 0) return
    if (!values.has(value)) values.set(value, label)
  }

  add(0, 'Zero')
  schedule.brackets.forEach((bracket, index) => {
    add(bracket.minimum - 1, `Just below bracket ${index + 1} minimum`)
    add(bracket.minimum, `Bracket ${index + 1} minimum`)
    add(bracket.minimum + 1, `Just above bracket ${index + 1} minimum`)
    if (bracket.maximum !== null) {
      add(bracket.maximum - 1, `Just below bracket ${index + 1} maximum`)
      add(bracket.maximum, `Bracket ${index + 1} maximum`)
      add(bracket.maximum + 1, `Just above bracket ${index + 1} maximum`)
    }
  })
  add(1_000_000_000_00, 'Very large value')

  return [...values.entries()]
    .sort(([a], [b]) => a - b)
    .map(([value, label]) => {
      const index = schedule.brackets.findIndex(
        (bracket) =>
          value >= bracket.minimum && (bracket.maximum === null || value < bracket.maximum),
      )
      const bracket = index === -1 ? undefined : schedule.brackets[index]
      return {
        label,
        value,
        bracketIndex: bracket ? index : null,
        amount: bracket ? applyBracket(bracket, index, value).total : null,
      }
    })
}
