import { sql } from 'drizzle-orm'
import { boolean, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { banks } from './banks'

/**
 * The "importer" for a bank's CSV format: a saved column mapping reusable across
 * all that bank's accounts. `config` is the typed CsvMappingConfig (delimiter,
 * field→column mapping, date/amount transforms, dedup keys). One default per bank.
 */
export const csvMappings = pgTable(
  'csv_mappings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    bankId: uuid('bank_id')
      .notNull()
      .references(() => banks.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    config: jsonb('config').$type<Record<string, unknown>>().notNull(),
    isDefault: boolean('is_default').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('csv_mappings_bank_name_idx').on(table.bankId, table.name),
    // At most one default mapping per bank.
    uniqueIndex('csv_mappings_bank_default_idx')
      .on(table.bankId)
      .where(sql`${table.isDefault} = true`),
  ],
)
