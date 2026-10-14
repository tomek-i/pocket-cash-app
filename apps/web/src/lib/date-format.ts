/**
 * The one way dates are shown in the app: "12 Aug" for this year, "12 Dec 2025"
 * for any other, in the order and month names of the locale chosen in Settings
 * (the same one numbers follow). Dates are stored as `YYYY-MM-DD` calendar days,
 * so they are formatted in UTC and never shift a day with the time zone.
 *
 * Exports and anything a machine reads (CSV, URLs, the database) keep ISO dates;
 * this is for display only.
 */

export interface DateFormatOptions {
  /** Show the year even when it is the current one, e.g. for a range label. */
  alwaysYear?: boolean
  /** For tests. Defaults to now. */
  today?: Date
}

function parseIsoDay(iso: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!match) return null
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
}

/** A calendar day (`YYYY-MM-DD`) for display. Returns the input unchanged if it is not one. */
export function formatDate(iso: string, locale: string, options: DateFormatOptions = {}): string {
  const date = parseIsoDay(iso)
  if (!date) return iso
  const thisYear = (options.today ?? new Date()).getFullYear()
  const showYear = options.alwaysYear || date.getUTCFullYear() !== thisYear
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    ...(showYear ? { year: 'numeric' } : {}),
    timeZone: 'UTC',
  }).format(date)
}

/**
 * A month (`YYYY-MM` or a full date) for display: `long` is "October 2026",
 * `name` is "October", `short` is "Oct".
 */
export function formatMonth(
  key: string,
  locale: string,
  style: 'long' | 'name' | 'short' = 'long',
): string {
  const date = parseIsoDay(key.length === 7 ? `${key}-01` : key)
  if (!date) return key
  return new Intl.DateTimeFormat(locale, {
    month: style === 'short' ? 'short' : 'long',
    ...(style === 'long' ? { year: 'numeric' } : {}),
    timeZone: 'UTC',
  }).format(date)
}
