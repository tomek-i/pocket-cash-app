/** Cursor-based pagination primitives shared across list endpoints. */
export interface PageParams {
  /** Opaque cursor returned by a previous page; omit for the first page. */
  cursor?: string
  /** Max items to return. Implementations should clamp to a sane ceiling. */
  limit?: number
}

export interface Page<T> {
  items: T[]
  /** Cursor to fetch the next page, or null when there are no more items. */
  nextCursor: string | null
}

export const DEFAULT_PAGE_LIMIT = 20
export const MAX_PAGE_LIMIT = 100
