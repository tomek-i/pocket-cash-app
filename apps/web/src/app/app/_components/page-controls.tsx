'use client'

import { useEffect, useRef } from 'react'
import { savePageSizePreference } from '../_lib/page-size-actions'
import { type PageSize, toPageSize } from '../_lib/pagination'

/**
 * Remember the rows-per-page the URL is currently showing.
 *
 * Renders nothing. Navigation is a plain link, so the list changes the instant
 * it is clicked, and this records the choice afterwards so the next visit
 * defaults to it.
 *
 * Splitting the two is deliberate. Doing both inside one transition meant the
 * `router.push` was deferred until the save settled, and the URL and the list
 * sat on the old size until something else happened to re-render. A link cannot
 * fail that way.
 */
export function RememberPageSize({ size, preferred }: { size: number; preferred: PageSize }) {
  // Once per value, not once per render: the effect reruns on every navigation,
  // and a write per page view would be a write per click through a long list.
  const saved = useRef<PageSize | null>(null)

  useEffect(() => {
    // The URL is not to be trusted, so save what is actually on screen rather
    // than what was asked for: a refused ?size resolves back to the preference
    // and there is then nothing to store.
    const shown = toPageSize(size, preferred)
    if (shown === preferred || saved.current === shown) return
    saved.current = shown
    void savePageSizePreference(shown)
  }, [size, preferred])

  return null
}
