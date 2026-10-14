/**
 * Financial year arithmetic. Pure, so client components (like the date presets
 * in the transaction filters) can use it without pulling in the database.
 *
 * Australian financial year starts in July. A FY is named by its ending year:
 * FY2025 = 1 Jul 2024 – 30 Jun 2025.
 */
import { formatDate } from '../../../../lib/date-format'

export const FY_START_MONTH = 7

export function fyForDate(d: Date): number {
  return d.getUTCFullYear() + (d.getUTCMonth() + 1 >= FY_START_MONTH ? 1 : 0)
}

export function currentFy(): number {
  return fyForDate(new Date())
}

export function fyBounds(fy: number): { start: string; endInclusive: string } {
  return { start: `${fy - 1}-07-01`, endInclusive: `${fy}-06-30` }
}

export function fyLabel(fy: number): string {
  return `FY${fy}`
}

/** "1 Jul 2025 – 30 Jun 2026", in the given locale. */
export function fyRangeLabel(fy: number, locale: string): string {
  const { start, endInclusive } = fyBounds(fy)
  const day = (iso: string) => formatDate(iso, locale, { alwaysYear: true })
  return `${day(start)} – ${day(endInclusive)}`
}
