/**
 * Normalising recurring amounts. Everything a property costs or earns is entered
 * at whatever cadence the bill arrives, and reported monthly and annually.
 *
 * A month is an annual figure divided by 12, not four weeks. Weekly rent times
 * four understates the year by roughly 8%, which is the single most common error
 * in property spreadsheets.
 */

import type { Frequency } from './types'

/** How many times a year each frequency is charged. */
const PER_YEAR: Record<Exclude<Frequency, 'custom'>, number> = {
  weekly: 52,
  fortnightly: 26,
  monthly: 12,
  quarterly: 4,
  halfYearly: 2,
  annual: 1,
}

export interface RecurringAmount {
  /** Minor units, at `frequency`. */
  amount: number
  frequency: Frequency
  /** Times per year. Required when `frequency` is `custom`. */
  customPerYear?: number
}

export interface NormalisedAmount {
  /** Minor units per month. */
  monthly: number
  /** Minor units per year. */
  annual: number
}

/** Occurrences per year for a frequency, 0 when a custom cadence is missing. */
export function occurrencesPerYear(entry: RecurringAmount): number {
  if (entry.frequency === 'custom') return Math.max(0, entry.customPerYear ?? 0)
  return PER_YEAR[entry.frequency]
}

/** A recurring amount as monthly and annual figures, minor units. */
export function normalise(entry: RecurringAmount): NormalisedAmount {
  const annual = entry.amount * occurrencesPerYear(entry)
  return { annual: Math.round(annual), monthly: Math.round(annual / 12) }
}

/** Sum a list of recurring amounts into one monthly and annual total. */
export function normaliseTotal(entries: RecurringAmount[]): NormalisedAmount {
  const annual = entries.reduce(
    (total, entry) => total + entry.amount * occurrencesPerYear(entry),
    0,
  )
  return { annual: Math.round(annual), monthly: Math.round(annual / 12) }
}

/**
 * Convert an amount from one cadence to another, for example a weekly rent shown
 * as a monthly figure. Returns 0 when the source cadence never occurs.
 */
export function convertFrequency(
  amount: number,
  from: RecurringAmount['frequency'],
  to: RecurringAmount['frequency'],
  options: { fromCustomPerYear?: number; toCustomPerYear?: number } = {},
): number {
  const fromPerYear = occurrencesPerYear({
    amount,
    frequency: from,
    customPerYear: options.fromCustomPerYear,
  })
  const toPerYear = occurrencesPerYear({
    amount,
    frequency: to,
    customPerYear: options.toCustomPerYear,
  })
  if (fromPerYear === 0 || toPerYear === 0) return 0
  return Math.round((amount * fromPerYear) / toPerYear)
}
