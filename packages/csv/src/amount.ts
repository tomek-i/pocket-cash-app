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
 * Parse a single numeric cell to signed minor units. Sign comes from a `-` or,
 * when `parensNegative`, from wrapping parentheses. Returns `null` for an empty
 * or non-numeric cell (caller decides whether that's an error).
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

  if (s.includes('-')) negative = true

  // Keep only digits and decimal points.
  s = s.replace(/[^0-9.]/g, '')
  if (s === '' || s === '.') return null

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
 * money in, debit money out). Magnitudes are taken absolute. Returns `null` only
 * when BOTH cells are empty/non-numeric; an empty side counts as 0.
 */
export function parseSplitAmount(
  debitRaw: string,
  creditRaw: string,
  fmt: NumberFormat & { flipSign: boolean },
): number | null {
  const debit = parseSignedDecimal(debitRaw, fmt)
  const credit = parseSignedDecimal(creditRaw, fmt)
  if (debit === null && credit === null) return null

  const out = Math.abs(debit ?? 0)
  const inn = Math.abs(credit ?? 0)
  const amount = inn - out
  return fmt.flipSign ? -amount : amount
}
