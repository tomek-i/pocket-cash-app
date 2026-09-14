/**
 * Paging arithmetic, kept away from the component so it can be tested directly.
 *
 * The page number and page size both arrive from the URL, which is to say from
 * whatever someone typed there, so everything here treats its input as hostile
 * and returns something renderable rather than trusting it.
 */

/** The page sizes offered. Anything else in the URL is refused, not honoured. */
export const PAGE_SIZES = [25, 50, 100, 200] as const

export type PageSize = (typeof PAGE_SIZES)[number]

export const DEFAULT_PAGE_SIZE: PageSize = 50

/**
 * A page size that is safe to put in a SQL `limit`.
 *
 * Deliberately not a clamp to a range: an arbitrary `?size=100000` would still
 * be inside any sane range and would still fetch the whole table. Only the
 * offered sizes are allowed through, and anything else falls back.
 */
export function toPageSize(value: unknown, fallback: PageSize = DEFAULT_PAGE_SIZE): PageSize {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10)
  return PAGE_SIZES.find((size) => size === parsed) ?? fallback
}

/** How many pages a result set fills. Always at least one, so "Page 1 / 1" reads. */
export function pageCount(total: number, pageSize: number): number {
  if (pageSize <= 0) return 1
  return Math.max(1, Math.ceil(total / pageSize))
}

/** A page number that exists, given the total. */
export function clampPage(page: number, totalPages: number): number {
  if (!Number.isFinite(page)) return 1
  return Math.min(Math.max(1, Math.trunc(page)), Math.max(1, totalPages))
}

/** A gap in the numbering, where pages are skipped. */
export const GAP = 'gap' as const

export type PaginationItem = number | typeof GAP

/**
 * The page numbers to show: the first, the last, and a window around the current
 * one, with gaps marking what was skipped.
 *
 * The window is a fixed width rather than a fixed span, so the control does not
 * change size as you move through the pages. Without that, stepping from page 2
 * to page 3 shifts every button sideways and the next click lands on the wrong
 * one.
 */
export function paginationItems(page: number, totalPages: number, window = 2): PaginationItem[] {
  const current = clampPage(page, totalPages)
  // First, last, two gaps and the window either side. This is the widest the
  // control ever gets, so when that many pages exist it shows them all.
  const maxShown = window * 2 + 5

  if (totalPages <= maxShown) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  let start = current - window
  let end = current + window

  // Near an end there is no gap on that side, so the window takes the slot the
  // gap would have used. Without this the control is a button narrower on page 1
  // than on page 25, and every button shifts as you move between them.
  if (start < 2) {
    start = 2
    end = start + window * 2 + 1
  } else if (end > totalPages - 1) {
    end = totalPages - 1
    start = end - window * 2 - 1
  }

  // A gap that hides a single page is wider than the page it hides.
  if (start === 3) start = 2
  if (end === totalPages - 2) end = totalPages - 1

  const items: PaginationItem[] = [1]
  if (start > 2) items.push(GAP)
  for (let n = start; n <= end; n++) items.push(n)
  if (end < totalPages - 1) items.push(GAP)
  items.push(totalPages)

  return items
}

/** The `n-m of total` range a page covers, for the summary line. */
export function pageRange(
  page: number,
  pageSize: number,
  total: number,
): { first: number; last: number } {
  if (total === 0) return { first: 0, last: 0 }
  const first = (page - 1) * pageSize + 1
  return { first, last: Math.min(page * pageSize, total) }
}
