/**
 * Pairing logic for suggested transfers between the user's own accounts. The
 * database finds every money-out / money-in combination that could be one
 * transfer; this decides which of them to suggest.
 */

/** One side of a possible transfer. */
export interface TransferSide {
  id: string
  date: string
  description: string
  displayName: string | null
  accountName: string
  /** Already marked as a transfer, or filed under the Transfers category. */
  flagged: boolean
}

/** A money-out row and a money-in row that cancel each other out. */
export interface TransferCandidate {
  out: TransferSide
  in: TransferSide
  /** Positive amount in minor units. */
  amount: number
  currency: string
}

export interface TransferSuggestion extends TransferCandidate {
  /** Days between the two bookings. */
  gapDays: number
  /** Something beyond the amount says this is a transfer, so it starts ticked. */
  likely: boolean
}

const TRANSFER_WORDS = /\b(transfer|tfr|xfer|trf|internal|own account|to savings|from savings)\b/i

/** Lowercased letters and digits only, for comparing names inside narratives. */
function squash(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function describes(side: TransferSide, otherAccountName: string): boolean {
  const text = `${side.displayName ?? ''} ${side.description}`
  if (TRANSFER_WORDS.test(text)) return true
  const other = squash(otherAccountName)
  return other.length >= 4 && squash(text).includes(other)
}

/** Whether anything beyond a matching amount points at a transfer. */
export function looksLikeTransfer(candidate: TransferCandidate): boolean {
  return (
    candidate.out.flagged ||
    candidate.in.flagged ||
    describes(candidate.out, candidate.in.accountName) ||
    describes(candidate.in, candidate.out.accountName)
  )
}

function gapDays(a: string, b: string): number {
  const ms = Math.abs(new Date(`${a}T00:00:00Z`).getTime() - new Date(`${b}T00:00:00Z`).getTime())
  return Math.round(ms / 86_400_000)
}

export function dismissalKey(outId: string, inId: string): string {
  return `${outId}:${inId}`
}

/**
 * Choose at most one partner per transaction. Likely pairs win over plain
 * amount matches, then the closest dates win, so a monthly $400 transfer pairs
 * with the $400 that arrived the same day rather than one from the week before.
 * Dismissed pairs are never suggested.
 */
export function pickTransferPairs(
  candidates: TransferCandidate[],
  dismissed: Set<string> = new Set(),
): TransferSuggestion[] {
  const ranked = candidates
    .filter((c) => !dismissed.has(dismissalKey(c.out.id, c.in.id)))
    .map((c) => ({ ...c, gapDays: gapDays(c.out.date, c.in.date), likely: looksLikeTransfer(c) }))
    .sort(
      (a, b) =>
        Number(b.likely) - Number(a.likely) ||
        a.gapDays - b.gapDays ||
        b.out.date.localeCompare(a.out.date),
    )

  const used = new Set<string>()
  const picked: TransferSuggestion[] = []
  for (const c of ranked) {
    if (used.has(c.out.id) || used.has(c.in.id)) continue
    used.add(c.out.id)
    used.add(c.in.id)
    picked.push(c)
  }
  return picked.sort((a, b) => b.out.date.localeCompare(a.out.date))
}
