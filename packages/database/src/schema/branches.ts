import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { banks } from './banks'

/**
 * A branch of a bank. First-class so it can hold branch-level identifiers (sort
 * code / routing number), but an account's branch is optional — online-only
 * banks have none.
 */
export const branches = pgTable(
  'branches',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    bankId: uuid('bank_id')
      .notNull()
      .references(() => banks.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    sortCode: text('sort_code'), // UK
    routingNumber: text('routing_number'), // US
    address: text('address'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('branches_bank_idx').on(table.bankId)],
)
