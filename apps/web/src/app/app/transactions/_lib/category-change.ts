/**
 * The category a bulk edit is about to apply: `'nochange'` leaves it alone,
 * `'none'` clears it, anything else is a category id.
 */
export type PendingCategory = 'nochange' | 'none' | (string & {})

/**
 * Whether applying `pending` would replace a category the row already has.
 *
 * Filling in an empty category is not an overwrite, and neither is setting the
 * one it already carries. Clearing a set category is, since that loses it too.
 */
export function overwritesCategory(current: string | null, pending: PendingCategory): boolean {
  if (pending === 'nochange' || current === null) return false
  if (pending === 'none') return true
  return current !== pending
}
