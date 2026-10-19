import { ACCOUNT_TYPES, BILLING_CYCLES, SUBSCRIPTION_STATUSES } from '@repo/types'
import { pgEnum } from 'drizzle-orm/pg-core'

/** Account kind. Values come from the canonical ACCOUNT_TYPES tuple. */
export const accountTypeEnum = pgEnum('account_type', ACCOUNT_TYPES)

/** Billing cadence of a financial subscription. From the BILLING_CYCLES tuple. */
export const billingCycleEnum = pgEnum('billing_cycle', BILLING_CYCLES)

/** Lifecycle of a financial subscription. From the SUBSCRIPTION_STATUSES tuple. */
export const subscriptionStatusEnum = pgEnum('subscription_status', SUBSCRIPTION_STATUSES)

/** Lifecycle of a CSV import run (internal — not surfaced as a shared type). */
export const IMPORT_STATUSES = ['pending', 'completed', 'failed'] as const
export const importStatusEnum = pgEnum('import_status', IMPORT_STATUSES)
