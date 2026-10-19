import { bigint, date, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { categories } from './categories'
import { billingCycleEnum, subscriptionKindEnum, subscriptionStatusEnum } from './enums'

/**
 * A recurring payment: a subscription (Netflix, Spotify) or a bill (power,
 * insurance), told apart by `kind`. Either entered manually or applied from an
 * auto-detected suggestion. `matcher` is a lowercase substring of the
 * transaction description used to recognise the charge in imported transactions.
 *
 * `categoryId` is what the payment is for (Entertainment, Utilities), not that it
 * recurs: `kind` already says that.
 *
 * `status` is what the user set. A paused subscription with a `pausedUntil` date
 * counts as active again from that date, and a cancelled one with an `endDate`
 * still to come counts as active until then. `pausedUntil` is empty for a pause
 * that lasts until the user resumes it.
 */
export const financialSubscriptions = pgTable('financial_subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  kind: subscriptionKindEnum('kind').notNull().default('subscription'),
  amount: bigint('amount', { mode: 'number' }).notNull(), // cost in minor units (positive)
  currency: text('currency').notNull().default('USD'),
  cycle: billingCycleEnum('cycle').notNull().default('monthly'),
  nextPaymentDate: date('next_payment_date'),
  categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
  matcher: text('matcher'), // lowercase description substring for transaction matching
  status: subscriptionStatusEnum('status').notNull().default('active'),
  pausedUntil: date('paused_until'), // only read while paused
  endDate: date('end_date'), // only read while cancelled
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
