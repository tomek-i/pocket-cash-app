import { BILLING_CYCLE_DAYS, type BillingCycle, type SubscriptionStatus } from '@repo/types'

export const CYCLE_LABELS: Record<BillingCycle, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
}

export const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  active: 'Active',
  paused: 'Paused',
  cancelled: 'Cancelled',
}

/** Calendar step of one cycle. Months keep the day of month, weeks count days. */
const CYCLE_STEP: Record<BillingCycle, { months: number } | { days: number }> = {
  weekly: { days: 7 },
  monthly: { months: 1 },
  quarterly: { months: 3 },
  yearly: { months: 12 },
}

/** How many days a charge may land either side of its due date. */
const GRACE_DAYS: Record<BillingCycle, number> = {
  weekly: 2,
  monthly: 5,
  quarterly: 5,
  yearly: 5,
}

/** What one cycle's amount costs per month, on a 30-day month. Minor units. */
export function monthlyCost(amount: number, cycle: BillingCycle): number {
  return Math.round(amount * (30 / BILLING_CYCLE_DAYS[cycle]))
}

/** Zero-padded YYYY-MM-DD in local time. */
export function todayIso(now: Date = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function addDays(isoDate: string, days: number): string {
  const next = new Date(`${isoDate}T00:00:00Z`)
  next.setUTCDate(next.getUTCDate() + days)
  return next.toISOString().slice(0, 10)
}

/**
 * The payment `steps` cycles after `anchor`. Counted from the anchor each time,
 * so a subscription billed on the 31st lands on 28 Feb and then 31 Mar again.
 */
function occurrence(anchor: string, cycle: BillingCycle, steps: number): string {
  const step = CYCLE_STEP[cycle]
  if ('days' in step) return addDays(anchor, step.days * steps)

  const start = new Date(`${anchor}T00:00:00Z`)
  const monthIndex = start.getUTCMonth() + step.months * steps
  const lastDay = new Date(Date.UTC(start.getUTCFullYear(), monthIndex + 1, 0)).getUTCDate()
  return new Date(
    Date.UTC(start.getUTCFullYear(), monthIndex, Math.min(start.getUTCDate(), lastDay)),
  )
    .toISOString()
    .slice(0, 10)
}

/**
 * Roll a stored next payment date forward by whole cycles until it is today or
 * later. `lastDue` is the payment just before it, or null when the stored date
 * has not passed yet.
 */
export function rollForward(
  anchor: string,
  cycle: BillingCycle,
  today: string,
): { next: string; lastDue: string | null } {
  let steps = 0
  let next = anchor
  let lastDue: string | null = null
  while (next < today) {
    lastDue = next
    steps += 1
    next = occurrence(anchor, cycle, steps)
  }
  return { next, lastDue }
}

/** Lowercased letters and single spaces only, for comparing bank narratives. */
export function normalizeText(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[0-9]+/g, ' ')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** An outflow that might be a subscription charge. */
export interface Charge {
  /** Merchant or description, already passed through `normalizeText`. */
  text: string
  date: string
}

export type PaymentStatus =
  /** No next payment date is stored. */
  | { kind: 'unknown' }
  | { kind: 'upcoming'; date: string }
  /** The last expected charge is missing from the imported transactions. */
  | { kind: 'not-seen'; lastSeen: string | null }

/** The status fields the user sets on a subscription. */
export interface StatusFields {
  status: SubscriptionStatus
  pausedUntil: string | null
  endDate: string | null
}

export type Lifecycle =
  /** Billing. `endsOn` is a cancellation still to come, `resumedOn` a pause that ran out. */
  | { kind: 'active'; endsOn: string | null; resumedOn: string | null }
  /** On hold. `until` is null for a pause that lasts until the user resumes it. */
  | { kind: 'paused'; until: string | null }
  | { kind: 'cancelled'; endedOn: string | null }

/**
 * Where a subscription stands today, from what the user set. A timed pause ends
 * on its date by itself, and a cancellation only takes hold on its end date.
 */
export function lifecycle(sub: StatusFields, today: string): Lifecycle {
  if (sub.status === 'paused') {
    if (sub.pausedUntil && sub.pausedUntil <= today)
      return { kind: 'active', endsOn: null, resumedOn: sub.pausedUntil }
    return { kind: 'paused', until: sub.pausedUntil }
  }
  if (sub.status === 'cancelled') {
    if (sub.endDate && sub.endDate > today)
      return { kind: 'active', endsOn: sub.endDate, resumedOn: null }
    return { kind: 'cancelled', endedOn: sub.endDate }
  }
  return { kind: 'active', endsOn: null, resumedOn: null }
}

/** Whether a subscription is billing today, so it counts towards costs. */
export function isBilling(sub: StatusFields, today: string): boolean {
  return lifecycle(sub, today).kind === 'active'
}

const ALWAYS_ACTIVE: StatusFields = { status: 'active', pausedUntil: null, endDate: null }

/**
 * Where a subscription's payments stand today. A subscription is only flagged as
 * not seen when it has a matcher and the imported transactions reach past the
 * due date, so a missing import is not mistaken for a missing charge. A paused
 * one shows the first payment after its pause, and a cancelled one shows none.
 */
export function paymentStatus(
  sub: {
    cycle: BillingCycle
    nextPaymentDate: string | null
    matcher: string | null
  } & Partial<StatusFields>,
  context: { today: string; charges: Charge[]; dataThrough: string | null },
): PaymentStatus {
  if (!sub.nextPaymentDate) return { kind: 'unknown' }
  const state = lifecycle({ ...ALWAYS_ACTIVE, ...sub }, context.today)
  if (state.kind === 'cancelled') return { kind: 'unknown' }
  if (state.kind === 'paused') {
    if (!state.until) return { kind: 'unknown' }
    return { kind: 'upcoming', date: rollForward(sub.nextPaymentDate, sub.cycle, state.until).next }
  }

  const { next, lastDue } = rollForward(sub.nextPaymentDate, sub.cycle, context.today)
  if (state.endsOn && next >= state.endsOn) return { kind: 'unknown' }

  const matcher = sub.matcher ? normalizeText(sub.matcher) : ''
  const grace = GRACE_DAYS[sub.cycle]
  // A payment that fell inside a pause was never going to be charged.
  const expected = lastDue && (!state.resumedOn || lastDue >= state.resumedOn)
  if (
    matcher &&
    expected &&
    context.dataThrough &&
    context.dataThrough >= addDays(lastDue, grace)
  ) {
    let lastSeen: string | null = null
    for (const charge of context.charges) {
      if (!charge.text.includes(matcher)) continue
      if (!lastSeen || charge.date > lastSeen) lastSeen = charge.date
    }
    if (!lastSeen || lastSeen < addDays(lastDue, -grace)) return { kind: 'not-seen', lastSeen }
  }

  return { kind: 'upcoming', date: next }
}

/** Soonest payment first, then the ones not seen, then the ones with no date. */
export function byPaymentStatus(a: PaymentStatus, b: PaymentStatus): number {
  const rank = { upcoming: 0, 'not-seen': 1, unknown: 2 }
  if (a.kind === 'upcoming' && b.kind === 'upcoming') return a.date.localeCompare(b.date)
  return rank[a.kind] - rank[b.kind]
}
