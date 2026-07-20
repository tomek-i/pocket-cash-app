import {
  bigint,
  date,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { accounts } from './accounts'
import { categories } from './categories'
import { csvImports } from './csv-imports'

/**
 * The canonical, bank-agnostic transaction. Every bank's CSV row is normalised
 * into this shape by an importer (see csv_mappings).
 *
 * - `amount` is a single SIGNED integer in minor units (negative = out).
 * - `description` is the raw bank narrative (immutable, feeds dedup);
 *   `displayName` is the user's optional clean override.
 * - `rawData` keeps the original CSV row for re-mapping/audit.
 * - `fingerprint` is the dedup key, unique per account.
 */
export const transactions = pgTable(
  'transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    date: date('date').notNull(), // booking date (YYYY-MM-DD)
    valueDate: date('value_date'),
    description: text('description').notNull(),
    displayName: text('display_name'),
    merchant: text('merchant'),
    amount: bigint('amount', { mode: 'number' }).notNull(), // signed minor units
    currency: text('currency').notNull(),
    balance: bigint('balance', { mode: 'number' }), // running balance, if present
    reference: text('reference'),
    notes: text('notes'),
    categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
    importId: uuid('import_id').references(() => csvImports.id, { onDelete: 'set null' }),
    rawData: jsonb('raw_data').$type<Record<string, string>>().notNull(),
    fingerprint: text('fingerprint').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('transactions_account_fingerprint_idx').on(table.accountId, table.fingerprint),
    index('transactions_account_date_idx').on(table.accountId, table.date),
    // Trigram GIN index for fuzzy "similar transactions" search (pg_trgm's `%`
    // operator + similarity()). The pg_trgm extension itself is created before
    // migrations run in runEmbeddedMigrations() (@repo/database/embedded).
    index('transactions_description_trgm_idx').using('gin', table.description.op('gin_trgm_ops')),
  ],
)
