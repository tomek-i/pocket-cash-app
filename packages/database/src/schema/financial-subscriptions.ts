import { bigint, boolean, date, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { categories } from './categories'
import { billingCycleEnum } from './enums'

/**
 * A recurring bill the user pays — Netflix, Spotify, rent. Either entered
 * manually or applied from an auto-detected suggestion. `matcher` is a lowercase
 * substring of the transaction description used to recognise the charge in
 * imported transactions.
 */
export const financialSubscriptions = pgTable('financial_subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  amount: bigint('amount', { mode: 'number' }).notNull(), // cost in minor units (positive)
  currency: text('currency').notNull().default('USD'),
  cycle: billingCycleEnum('cycle').notNull().default('monthly'),
  nextPaymentDate: date('next_payment_date'),
  categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
  matcher: text('matcher'), // lowercase description substring for transaction matching
  active: boolean('active').notNull().default(true),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
