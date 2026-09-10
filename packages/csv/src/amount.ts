/**
 * Amount parsing → signed integer **minor units** (e.g. cents). All maths is done
 * on strings to avoid floating-point money errors. Handles decimal/thousands
 * separators, leading/trailing minus, parenthesised negatives, and combining
 * separate debit/credit columns into one signed value.
 */

export interface NumberFormat {
  decimal: string
  thousands: string
  minorUnitDigits: number
  parensNegative: boolean
}

/**
 * Decoration that can surround a number without changing it. `\s` covers the
 * non-breaking space banks like to emit, `\p{Sc}` covers currency symbols in any
 * script, and the apostrophe is grouping in some locales.
 */
const DECORATION = /[\s']|\p{Sc}/gu

/**
 * What has to be left once the decoration and the separators are gone.
 *
 * This is the guard. The parser used to strip every character that was not a
 * digit or a dot, which meant a date or a narrative was not rejected but
 * *salvaged*: `12/08/2026` became `12082026` and `WOOLWORTHS 3021 NEWTOWN`
 * became `3021`, and the result passed validation. In a finance app, importing a
 * confident wrong number is worse than refusing the row.
 */
const NUMERIC = /^(?:\d+(?:\.\d*)?|\.\d+)$/

/**
 * Parse a single numeric cell to signed minor units. Sign comes from a leading
 * or trailing `-`, or when `parensNegative`, from wrapping parentheses. Returns
 * `null` for an empty cell and for anything that is not a well-formed number
 * (caller decides whether that's an error).
 */
export function parseSignedDecimal(raw: string, fmt: NumberFormat): number | null {
  let s = raw.trim()
  if (!s) return null

  let negative = false
  if (fmt.parensNegative && s.startsWith('(') && s.endsWith(')')) {
    negative = true
    s = s.slice(1, -1)
  }

  // Normalise separators: drop thousands, unify decimal to ".".
  if (fmt.thousands) s = s.split(fmt.thousands).join('')
  if (fmt.decimal !== '.') s = s.split(fmt.decimal).join('.')

  s = s.replace(DECORATION, '')

  // Any comma still here cannot be the decimal point, since that was normalised
  // above, so it can only be grouping. Tolerating it keeps "1,234.50" working
  // under the default mapping, which does not configure a thousands separator.
  s = s.split(',').join('')

  // A sign is allowed at either end and nowhere else. `1-2` is not a number.
  if (s.startsWith('-') || s.endsWith('-')) {
    negative = true
    s = s.startsWith('-') ? s.slice(1) : s.slice(0, -1)
  } else if (s.startsWith('+') || s.endsWith('+')) {
    s = s.startsWith('+') ? s.slice(1) : s.slice(0, -1)
  }

  if (!NUMERIC.test(s)) return null

  const lastDot = s.lastIndexOf('.')
  const intStr = (lastDot === -1 ? s : s.slice(0, lastDot)).replace(/\./g, '')
  const fracStr = lastDot === -1 ? '' : s.slice(lastDot + 1)

  const digits = fmt.minorUnitDigits
  const frac = (fracStr + '0'.repeat(digits)).slice(0, digits)
  const intVal = intStr === '' ? 0 : Number(intStr)
  const fracVal = digits === 0 ? 0 : Number(frac || '0')
  if (!Number.isFinite(intVal) || !Number.isFinite(fracVal)) return null

  const minor = intVal * 10 ** digits + fracVal
  return negative ? -minor : minor
}

/** Single-column amount: parse, then optionally invert the sign. */
export function parseSingleAmount(
  raw: string,
  fmt: NumberFormat & { flipSign: boolean },
): number | null {
  const value = parseSignedDecimal(raw, fmt)
  if (value === null) return null
  return fmt.flipSign ? -value : value
}

/**
 * Separate debit/credit columns → one signed value: `credit - debit` (credit is
 * money in, debit money out). Magnitudes are taken absolute.
 *
 * Empty and unparseable are different things here, which they were not before.
 * A blank side is a real 0, because a statement puts the amount in one column
 * and leaves the other empty. A side that holds something which is *not* a
 * number is a mapping pointed at the wrong column, and treating that as 0 is how
 * a date minus a narrative used to import as an amount. Both cases return
 * `null`, so the caller raises a row error.
 */
export function parseSplitAmount(
  debitRaw: string,
  creditRaw: string,
  fmt: NumberFormat & { flipSign: boolean },
): number | null {
  const debitBlank = debitRaw.trim() === ''
  const creditBlank = creditRaw.trim() === ''
  if (debitBlank && creditBlank) return null

  const debit = debitBlank ? 0 : parseSignedDecimal(debitRaw, fmt)
  const credit = creditBlank ? 0 : parseSignedDecimal(creditRaw, fmt)
  if (debit === null || credit === null) return null

  const amount = Math.abs(credit) - Math.abs(debit)
  return fmt.flipSign ? -amount : amount
}
