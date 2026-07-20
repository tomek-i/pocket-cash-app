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
