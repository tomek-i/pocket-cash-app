import { boolean, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

/**
 * A place with its own purchase-tax rules, e.g. Australia / New South Wales.
 *
 * A jurisdiction carries the local *vocabulary* as well as the local rates:
 * `transferTaxLabel` is what this place calls its purchase tax ("Transfer Duty",
 * "Stamp Duty Land Tax", "State / Local Transfer Tax"). The calculation engine
 * never renders a name, so supporting another country is a data change.
 *
 * `key` is the opaque string the engine matches schedules on (`AU-NSW`). Rate
 * schedules reference it rather than the uuid, so a row read straight out of
 * this table drops into `selectSchedule` unchanged.
 */
export const jurisdictions = pgTable(
  'jurisdictions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // A UNIQUE constraint, not a unique index: Postgres only accepts a
    // constraint as a foreign key target, and rate schedules and properties both
    // reference this column.
    key: text('key').notNull().unique(),
    name: text('name').notNull(),
    country: text('country').notNull(), // ISO-3166-1 alpha-2
    region: text('region'), // subdivision code, null for country-wide
    currency: text('currency').notNull(), // ISO-4217
    transferTaxLabel: text('transfer_tax_label').notNull(),
    /** Seeded by Pocket Cash. System rows are never overwritten by a re-seed. */
    isSystem: boolean('is_system').notNull().default(false),
    enabled: boolean('enabled').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('jurisdictions_country_idx').on(table.country)],
)
