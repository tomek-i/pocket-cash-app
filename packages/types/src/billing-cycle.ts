/**
 * Billing cadence of a *financial* subscription (a recurring bill the user pays,
 * e.g. Netflix) — unrelated to the app's own Polar billing. Single source of
 * truth shared by the database enum, validation, and UI — same pattern as
 * ACCOUNT_TYPES / ROLES.
 */
export const BILLING_CYCLES = ['weekly', 'monthly', 'quarterly', 'yearly'] as const

export type BillingCycle = (typeof BILLING_CYCLES)[number]

/** Approximate length of one cycle in days — used to project the next payment. */
export const BILLING_CYCLE_DAYS: Record<BillingCycle, number> = {
  weekly: 7,
  monthly: 30,
  quarterly: 91,
  yearly: 365,
}

/**
 * Where a financial subscription stands. `paused` is a temporary hold, until a
 * set date or until the user resumes it. `cancelled` has ended for good and is
 * kept for its history.
 */
export const SUBSCRIPTION_STATUSES = ['active', 'paused', 'cancelled'] as const

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number]

/**
 * What a recurring payment is. A subscription is a lifestyle choice (Netflix, a
 * gym). A bill is an essential (power, water, insurance) and often varies in
 * amount from one charge to the next.
 */
export const SUBSCRIPTION_KINDS = ['subscription', 'bill'] as const

export type SubscriptionKind = (typeof SUBSCRIPTION_KINDS)[number]
