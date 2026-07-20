/**
 * Format integer minor units (e.g. cents) as a localised currency string.
 * `currencyDisplay: 'narrowSymbol'` uses the plain symbol (e.g. "$" rather than
 * "A$"/"US$"). Falls back to a plain number with the code appended if the
 * currency code isn't recognised by Intl.
 */
export function formatMoney(minorUnits: number, currency: string): string {
  const major = minorUnits / 100
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
    }).format(major)
  } catch {
    return `${major.toFixed(2)} ${currency}`
  }
}

/** Tailwind text colour for an amount: green for credit (≥0), red for debit. */
export function amountClassName(minorUnits: number): string {
  return minorUnits >= 0 ? 'text-success' : 'text-destructive'
}

/**
 * Parse a user-entered major-unit amount (e.g. "50" or "50.00") into integer
 * minor units. Returns undefined for empty/invalid/negative input so callers can
 * treat it as "no bound". Commas and a leading currency symbol are tolerated.
 */
export function parseAmountToMinor(value: string | undefined | null): number | undefined {
  if (!value) return undefined
  const cleaned = value.replace(/[^0-9.]/g, '')
  if (cleaned === '') return undefined
  const major = Number.parseFloat(cleaned)
  if (!Number.isFinite(major) || major < 0) return undefined
  return Math.round(major * 100)
}
