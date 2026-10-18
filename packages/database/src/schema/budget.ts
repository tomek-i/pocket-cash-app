import { BUDGET_BUCKET_TYPES } from '@repo/budget'
import {
  bigint,
  boolean,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { categories } from './categories'

/**
 * The budget planner. There is one plan and it is always live: no history, no
 * versions. Past months are measured against the plan as it is now.
 */

/** Bucket type. Values come from the canonical BUDGET_BUCKET_TYPES tuple. */
export const budgetBucketTypeEnum = pgEnum('budget_bucket_type', BUDGET_BUCKET_TYPES)

/** A named monthly income, entered by hand as the net amount that lands. */
export const budgetIncomes = pgTable('budget_incomes', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  amount: bigint('amount', { mode: 'number' }).notNull(), // minor units per month
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * One row per bucket type. Removing a bucket from the plan sets `active` to
 * false rather than deleting the row, so its category assignments survive a
 * preset switch and come back with the bucket. Active shares add up to 10000.
 */
export const budgetBuckets = pgTable('budget_buckets', {
  type: budgetBucketTypeEnum('type').primaryKey(),
  label: text('label'), // the user's rename; null means the default name
  shareBps: integer('share_bps').notNull().default(0),
  active: boolean('active').notNull().default(false),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * Where a category sits in the budget. A category is in at most one bucket.
 * A row with a null `bucketType` leaves the category out of the budget on
 * purpose (income, transfers), so it is not flagged as unbudgeted. No row at all
 * means nobody has decided yet.
 */
export const budgetBucketCategories = pgTable('budget_bucket_categories', {
  categoryId: uuid('category_id')
    .primaryKey()
    .references(() => categories.id, { onDelete: 'cascade' }),
  bucketType: budgetBucketTypeEnum('bucket_type').references(() => budgetBuckets.type, {
    onDelete: 'cascade',
  }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
