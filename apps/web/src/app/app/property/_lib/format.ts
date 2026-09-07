/**
 * Turning stored values into the strings a text input shows, and back.
 *
 * These live in one place because getting them subtly wrong is invisible until
 * it reaches the screen. Multiplying a stored decimal by 100 to show a
 * percentage is the trap: `0.07 * 100` is `7.000000000000001` in binary
 * floating point, and that is what the user sees in the box.
 */

/** Minor units to the major-unit string a money input shows. */
export function toMajorInput(minorUnits: number | null | undefined): string {
  if (minorUnits === null || minorUnits === undefined) return ''
  return (minorUnits / 100).toString()
}

/**
 * A stored decimal rate to the percentage string an input shows.
 *
 * Rounded to four decimal places, which is the precision the validation accepts,
 * then trimmed of trailing zeros. Without the rounding a stored `0.07` renders
 * as `7.000000000000001`.
 */
export function toPercentInput(decimal: number | null | undefined): string {
  if (decimal === null || decimal === undefined) return ''
  return Number((decimal * 100).toFixed(4)).toString()
}

/** A typed major-unit amount back to minor units. Invalid input reads as 0. */
export function toMinorUnits(value: string): number {
  const cleaned = value.replace(/[\s,$]/g, '')
  const parsed = Number.parseFloat(cleaned)
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) : 0
}

/** A typed percentage back to a decimal. Invalid input reads as 0. */
export function toRateDecimal(value: string): number {
  const parsed = Number.parseFloat(value.replace(/[\s%]/g, ''))
  return Number.isFinite(parsed) && parsed >= 0 ? parsed / 100 : 0
}

/** A decimal ratio as a display percentage, e.g. `0.8` becomes "80.0%". */
export function formatPercent(decimal: number, decimals = 1): string {
  return `${(decimal * 100).toFixed(decimals)}%`
}
