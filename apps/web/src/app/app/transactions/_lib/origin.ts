/**
 * Where a transaction was opened from, carried through the URL.
 *
 * The list holds all of its state in search params: filters, amount bounds, dates
 * and the page number. None of it reached the detail route, so the back link had
 * nowhere to go but `/app/transactions`, and paging to row 300 of a filtered set
 * to check one transaction meant doing the narrowing again to check the next.
 *
 * Carried explicitly rather than relying on `router.back()`, so the link still
 * works when the detail page is loaded directly or refreshed, and so it can say
 * where it goes rather than just "back".
 */

/** The query key. Short, because it sits alongside the filters it is preserving. */
export const ORIGIN_PARAM = 'from'

export interface Origin {
  href: string
  /** What the back link calls the place it returns to. */
  label: string
}

const DEFAULT_ORIGIN: Origin = { href: '/app/transactions', label: 'Transactions' }

/** Append the origin to a transaction link. */
export function withOrigin(href: string, origin: string | undefined): string {
  if (!origin) return href
  return `${href}?${ORIGIN_PARAM}=${encodeURIComponent(origin)}`
}

/**
 * Read an origin back, falling back to the transactions list.
 *
 * Only same-app paths are accepted. The value arrives from the URL, so it is
 * whatever someone put there, and a back link is a navigation target: anything
 * that is not a plain `/app/...` path is discarded rather than followed. The
 * leading-slash-slash check matters because `//evil.example` is a protocol
 * relative URL, not a path.
 */
export function parseOrigin(value: string | undefined): Origin {
  if (!value?.startsWith('/app/') || value.startsWith('//')) return DEFAULT_ORIGIN

  return { href: value, label: labelFor(value) }
}

/**
 * Name the place a path came from.
 *
 * Derived rather than passed as a second query parameter, so the URL carries one
 * fact instead of two that could disagree.
 */
function labelFor(href: string): string {
  const path = href.split('?')[0] ?? ''
  const fy = path.match(/^\/app\/reports\/(\d{4})$/)
  if (fy) return `FY${fy[1]} report`
  return DEFAULT_ORIGIN.label
}
