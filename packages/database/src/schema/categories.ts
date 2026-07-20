import { pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'

/**
 * A user-defined spending/income category ("Groceries", "Salary"). Transactions
 * and financial subscriptions reference a category; deleting one nulls those
 * links rather than cascading.
 */
export const categories = pgTable(
  'categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    color: text('color'), // hex, optional
    icon: text('icon'), // lucide icon name, optional
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('categories_name_idx').on(table.name)],
)
