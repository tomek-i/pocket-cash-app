import { index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { accounts } from './accounts'
import { csvMappings } from './csv-mappings'
import { importStatusEnum } from './enums'

/**
 * One CSV import run (batch). Records totals for history and lets an import be
 * undone — deleting a row cascades to the transactions it created
 * (transactions.importId → set null is intentional only for non-cascade paths;
 * undo deletes via importId explicitly).
 */
export const csvImports = pgTable(
  'csv_imports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    mappingId: uuid('mapping_id').references(() => csvMappings.id, { onDelete: 'set null' }),
    fileName: text('file_name').notNull(),
    rowCount: integer('row_count').notNull().default(0),
    importedCount: integer('imported_count').notNull().default(0),
    skippedCount: integer('skipped_count').notNull().default(0),
    errorCount: integer('error_count').notNull().default(0),
    status: importStatusEnum('status').notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('csv_imports_account_idx').on(table.accountId)],
)
