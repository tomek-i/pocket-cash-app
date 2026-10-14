import { normalizeText } from './schedule'

/** What a tracked subscription is recognised by. */
export interface TrackedSubscription {
  name: string
  matcher: string | null
}

/** Whether every word of `needle` appears, in order and whole, inside `haystack`. */
function containsWords(haystack: string, needle: string): boolean {
  return ` ${haystack} `.includes(` ${needle} `)
}

/**
 * Whether a detected recurring charge is one the user already tracks, so it is
 * not offered again. A detection is keyed on the first words of the merchant
 * ("fitlife gym"), while a tracked subscription may carry a shorter matcher
 * ("fitlife") or a differently cased name ("FitLife Gym"), so both are compared
 * as whole words in either direction. Words shorter than three letters are
 * ignored, so a subscription called "TV" does not swallow every detection.
 */
export function isAlreadyTracked(detectionKey: string, tracked: TrackedSubscription[]): boolean {
  const key = normalizeText(detectionKey)
  if (!key) return false
  return tracked.some((t) =>
    [t.matcher, t.name].some((value) => {
      const other = value ? normalizeText(value) : ''
      if (other.length < 3) return false
      return containsWords(key, other) || containsWords(other, key)
    }),
  )
}

/** Why detections were left out, for the quiet line under the list. */
export interface HiddenDetections {
  tracked: number
  dismissed: number
  transfers: number
}

export function hiddenSummary(hidden: HiddenDetections): string | null {
  const total = hidden.tracked + hidden.dismissed + hidden.transfers
  if (total === 0) return null
  const reasons = [
    hidden.tracked > 0 ? 'already tracked' : null,
    hidden.dismissed > 0 ? 'marked as not a subscription' : null,
    hidden.transfers > 0 ? 'a transfer between your accounts' : null,
  ].filter(Boolean)
  const joined =
    reasons.length > 1 ? `${reasons.slice(0, -1).join(', ')}, or ${reasons.at(-1)}` : reasons[0]
  return `${total} hidden: ${joined}.`
}
