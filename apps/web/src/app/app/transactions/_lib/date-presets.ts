import { fyBounds, fyForDate } from '../../reports/_lib/fy'

/** The date choices in the transaction filters. */
export type DatePreset = 'any' | 'this-month' | 'last-month' | 'this-fy' | 'custom'

export const DATE_PRESET_LABELS: Record<DatePreset, string> = {
  any: 'Any time',
  'this-month': 'This month',
  'last-month': 'Last month',
  'this-fy': 'This financial year',
  custom: 'Custom range',
}

function ymd(year: number, monthIndex: number, day: number): string {
  const d = new Date(Date.UTC(year, monthIndex, day))
  return d.toISOString().slice(0, 10)
}

/**
 * The from/to range of a preset, both inclusive, as YYYY-MM-DD. Null for "any"
 * and "custom", which have no fixed range. `today` is a local calendar date.
 */
export function presetRange(
  preset: DatePreset,
  today: Date = new Date(),
): { from: string; to: string } | null {
  const year = today.getFullYear()
  const month = today.getMonth()
  switch (preset) {
    case 'this-month':
      return { from: ymd(year, month, 1), to: ymd(year, month + 1, 0) }
    case 'last-month':
      return { from: ymd(year, month - 1, 1), to: ymd(year, month, 0) }
    case 'this-fy': {
      const { start, endInclusive } = fyBounds(fyForDate(new Date(Date.UTC(year, month, 1))))
      return { from: start, to: endInclusive }
    }
    default:
      return null
  }
}

/** Which preset a from/to pair is, so the menu can show it. */
export function presetFor(from?: string, to?: string, today: Date = new Date()): DatePreset {
  if (!from && !to) return 'any'
  for (const preset of ['this-month', 'last-month', 'this-fy'] as const) {
    const range = presetRange(preset, today)
    if (range && range.from === from && range.to === to) return preset
  }
  return 'custom'
}
