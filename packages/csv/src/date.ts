/**
 * Parse a date using a bank-supplied format string into an ISO `YYYY-MM-DD`.
 * Supported tokens: `YYYY`, `YY` (→ 2000+), `MM`, `M`, `DD`, `D`. Any other
 * character in the format is a literal separator. Returns `null` when the input
 * doesn't match or is not a real calendar date.
 */

type Part = 'y' | 'y2' | 'm' | 'd'

// Longest tokens first so `YYYY` wins over `YY` and `MM`/`DD` over `M`/`D`.
const TOKENS: Array<{ token: string; pattern: string; part: Part }> = [
  { token: 'YYYY', pattern: '(\\d{4})', part: 'y' },
  { token: 'YY', pattern: '(\\d{2})', part: 'y2' },
  { token: 'MM', pattern: '(\\d{2})', part: 'm' },
  { token: 'DD', pattern: '(\\d{2})', part: 'd' },
  { token: 'M', pattern: '(\\d{1,2})', part: 'm' },
  { token: 'D', pattern: '(\\d{1,2})', part: 'd' },
]

function escapeRegex(ch: string): string {
  return ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function parseDate(input: string, format: string): string | null {
  const value = input.trim()
  if (!value) return null

  let regex = '^'
  const order: Part[] = []
  let i = 0
  while (i < format.length) {
    const match = TOKENS.find((t) => format.startsWith(t.token, i))
    if (match) {
      regex += match.pattern
      order.push(match.part)
      i += match.token.length
    } else {
      regex += escapeRegex(format.charAt(i))
      i++
    }
  }
  regex += '$'

  const m = new RegExp(regex).exec(value)
  if (!m) return null

  let year = 0
  let month = 0
  let day = 0
  for (let g = 0; g < order.length; g++) {
    const raw = m[g + 1]
    if (raw === undefined) return null
    const n = Number(raw)
    const part = order[g]
    if (part === 'y') year = n
    else if (part === 'y2') year = 2000 + n
    else if (part === 'm') month = n
    else day = n
  }

  if (month < 1 || month > 12 || day < 1) return null
  // Last day of `month` (Date months are 0-based, so day 0 of month rolls back).
  const lastDay = new Date(year, month, 0).getDate()
  if (day > lastDay) return null

  const yyyy = String(year).padStart(4, '0')
  const mm = String(month).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}
