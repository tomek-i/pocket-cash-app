import { pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'

/**
 * A financial institution the user holds money with ("Barclays", "Revolut").
 * User-defined free-form — no shared catalog. Accounts and CSV import mappings
 * hang off a bank.
 */
export const banks = pgTable(
  'banks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    country: text('country'), // ISO-3166 alpha-2, optional
    logoUrl: text('logo_url'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('banks_name_idx').on(table.name)],
)
