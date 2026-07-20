import { bigint, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { banks } from './banks'
import { branches } from './branches'
import { csvMappings } from './csv-mappings'
import { accountTypeEnum } from './enums'

/**
 * A specific account at a bank (and optionally a branch) — the thing a CSV
 * statement is imported into. Carries its own currency; transactions inherit it.
 * `defaultMappingId` points at the bank importer to preselect on import.
 */
export const accounts = pgTable(
  'accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    bankId: uuid('bank_id')
      .notNull()
      .references(() => banks.id, { onDelete: 'cascade' }),
    branchId: uuid('branch_id').references(() => branches.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    type: accountTypeEnum('type').notNull().default('checking'),
    currency: text('currency').notNull().default('USD'), // ISO-4217
    openingBalance: bigint('opening_balance', { mode: 'number' }), // minor units
    defaultMappingId: uuid('default_mapping_id').references(() => csvMappings.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('accounts_bank_idx').on(table.bankId),
    index('accounts_branch_idx').on(table.branchId),
  ],
)
