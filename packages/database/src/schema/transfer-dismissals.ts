import { pgTable, primaryKey, timestamp, uuid } from 'drizzle-orm/pg-core'
import { transactions } from './transactions'

/**
 * A suggested transfer pair the user said is not a transfer, so it is not
 * suggested again. `outId` is the side with the negative amount.
 */
export const transferDismissals = pgTable(
  'transfer_dismissals',
  {
    outId: uuid('out_id')
      .notNull()
      .references(() => transactions.id, { onDelete: 'cascade' }),
    inId: uuid('in_id')
      .notNull()
      .references(() => transactions.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.outId, table.inId] })],
)
