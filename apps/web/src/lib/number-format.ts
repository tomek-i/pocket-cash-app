/**
 * Locale-aware formatting for amount inputs.
 *
 * `450000` in a box is genuinely hard to read: nothing distinguishes it from
 * `45000` at a glance. These helpers group the digits as the user types, using
 * whatever separators their locale uses.
 *
 * The parsing half matters more than the formatting half. Stripping `,` and
 * calling `parseFloat` reads `450.000,50` as `450`, which is not a display
 * glitch but a wrong number, so the separators are always resolved from the
 * locale rather than assumed.
 */

export interface NumberSeparators {
  group: string
  decimal: string
}

/**
 * The separators a locale uses.
 *
 * Read out of `Intl` rather than hard-coded, because the group separator is not
 * always a comma or a dot: French uses a narrow no-break space, and Swiss German
 * an apostrophe.
 */
export function getSeparators(locale?: string): NumberSeparators {
  const parts = new Intl.NumberFormat(locale).formatToParts(12345.6)
  return {
    group: parts.find((part) => part.type === 'group')?.value ?? ',',
    decimal: parts.find((part) => part.type === 'decimal')?.value ?? '.',
  }
}

/** Group the integer part of a digit string, e.g. `450000` to `450,000`. */
function groupDigits(digits: string, group: string): string {
  if (digits.length <= 3) return digits
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, group)
}

interface TypedAmount {
  /** Digits before the decimal separator, ungrouped. */
  integer: string
  /** Digits after it, or `null` when the user has not typed a separator. */
  fraction: string | null
}

/**
 * Read what the user typed.
 *
 * Anything that is not a digit or the locale's decimal separator is dropped, so
 * a pasted `$450,000.50`, or a group separator the user typed themselves, is
 * handled without special cases. A trailing separator is kept as an empty
 * fraction so `450.` can be typed through.
 */
function readTyped(text: string, separators: NumberSeparators): TypedAmount {
  const decimalIndex = text.indexOf(separators.decimal)
  const hasDecimal = decimalIndex !== -1

  const digitsOnly = (value: string) => value.replace(/\D/g, '')

  if (!hasDecimal) return { integer: digitsOnly(text), fraction: null }

  return {
    integer: digitsOnly(text.slice(0, decimalIndex)),
    // Amounts are money, so never more than two decimals.
    fraction: digitsOnly(text.slice(decimalIndex + 1)).slice(0, 2),
  }
}

/**
 * What the input should show for what was typed.
 *
 * Returns an empty string for empty input rather than a `0`, so a cleared field
 * stays cleared.
 */
export function formatTypedAmount(text: string, locale?: string): string {
  const separators = getSeparators(locale)
  const { integer, fraction } = readTyped(text, separators)

  if (integer === '' && fraction === null) return ''

  const grouped = groupDigits(integer, separators.group)
  if (fraction === null) return grouped
  return `${grouped}${separators.decimal}${fraction}`
}

/**
 * What gets submitted: a plain `1234.56`, whatever the display looks like.
 *
 * Keeping the wire format canonical is what lets the Zod schemas stay as they
 * are, rather than every one of them learning about locales.
 */
export function toCanonicalAmount(text: string, locale?: string): string {
  const separators = getSeparators(locale)
  const { integer, fraction } = readTyped(text, separators)

  if (integer === '' && (fraction === null || fraction === '')) return ''
  if (fraction === null || fraction === '') return integer || '0'
  return `${integer || '0'}.${fraction}`
}

/** A canonical `1234.56` as the display string for an input. */
export function fromCanonicalAmount(value: string, locale?: string): string {
  if (!value) return ''
  const separators = getSeparators(locale)
  const [integer = '', fraction] = value.split('.')
  const grouped = groupDigits(integer.replace(/\D/g, ''), separators.group)
  return fraction ? `${grouped}${separators.decimal}${fraction}` : grouped
}

/**
 * How many digits sit before a caret position.
 *
 * Reformatting moves every character after an inserted separator, so the caret
 * cannot be restored by character offset. Counting digits is stable across the
 * reformat.
 */
export function digitsBefore(text: string, caret: number): number {
  return (text.slice(0, caret).match(/\d/g) ?? []).length
}

/** The caret position that sits after `count` digits of `text`. */
export function caretAfterDigits(text: string, count: number): number {
  if (count === 0) {
    // Sit before the first digit rather than at the very start, so a leading
    // currency symbol or separator does not swallow the caret.
    const first = text.search(/\d/)
    return first === -1 ? text.length : first
  }
  let seen = 0
  for (let i = 0; i < text.length; i += 1) {
    if (/\d/.test(text[i] as string)) {
      seen += 1
      if (seen === count) return i + 1
    }
  }
  return text.length
}

/** A number as a formatted placeholder, e.g. `450000` to `450,000`. */
export function formatPlaceholder(value: number, locale?: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value)
}

/**
 * The locale to format with.
 *
 * Pocket Cash runs entirely on the user's own machine, so the server and the
 * browser are the same computer and `Intl` resolves to the same locale in both.
 * That is what makes it safe to resolve this server side and pass it down, with
 * no hydration mismatch and no flash of unformatted numbers.
 */
export function resolveNumberLocale(override?: string): string {
  if (override) return override
  return Intl.DateTimeFormat().resolvedOptions().locale
}
