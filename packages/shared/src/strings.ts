/** Convert an arbitrary string to a URL-safe slug. */
export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '') // strip combining diacritical marks
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Truncate to `max` characters, appending an ellipsis when cut. */
export function truncate(input: string, max: number): string {
  if (input.length <= max) return input
  return `${input.slice(0, Math.max(0, max - 1)).trimEnd()}…`
}

/** Best-effort initials from a name, for avatar fallbacks. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const first = parts.at(0)
  if (!first) return '?'
  if (parts.length === 1) return first.slice(0, 2).toUpperCase()
  const last = parts.at(-1) ?? first
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase()
}
