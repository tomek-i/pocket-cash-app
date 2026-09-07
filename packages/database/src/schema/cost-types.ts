import {
  bigint,
  boolean,
  doublePrecision,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import {
  calculationBaseEnum,
  costCalculationTypeEnum,
  costScopeEnum,
  recurrenceFrequencyEnum,
} from './property-enums'

/**
 * A cost category, for grouping and filtering. Seeded, but users can add more,
 * so nothing may switch on these keys.
 */
export const costCategories = pgTable('cost_categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  key: text('key').notNull().unique(),
  name: text('name').notNull(),
  sortOrder: integer('sort_order').notNull().default(100),
  isSystem: boolean('is_system').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * The reusable definition of a cost. Seeded rows are starting records, not a
 * fixed list: adding "Solar Inspection, $250" is a settings change, never a code
 * change, so nothing in the app may special-case a `key` from the seed.
 *
 * Money is minor units. `percentage` and rates are decimals, matching the
 * engine, so `0.012` is 1.2%.
 *
 * Deleting a type that a property already uses is blocked by a foreign key on
 * `property_costs` (see that table). Set `deletedAt` instead: the type vanishes
 * from the Add Cost list while existing property records keep working.
 */
export const costTypes = pgTable(
  'cost_types',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Stable seed identifier, e.g. `building-inspection`. Null when user-created. */
    key: text('key').unique(),
    name: text('name').notNull(),
    category: text('category').notNull().default('other'),
    scope: costScopeEnum('scope').notNull().default('upfront'),
    calculationType: costCalculationTypeEnum('calculation_type').notNull().default('fixed'),
    /** Minor units. The default amount for a `fixed` cost. */
    defaultValue: bigint('default_value', { mode: 'number' }),
    /** Decimal, for a `percentage` cost. */
    percentage: doublePrecision('percentage'),
    calculationBase: calculationBaseEnum('calculation_base'),
    /** Expression for a `formula` cost. Parsed by the engine, never evaluated as JS. */
    formula: text('formula'),
    /** For a `bracketed` cost: which kind of rate schedule to resolve. */
    rateScheduleGroup: text('rate_schedule_group'),
    /** Usual cadence for a `recurring` scope cost. */
    defaultFrequency: recurrenceFrequencyEnum('default_frequency'),
    currency: text('currency'), // ISO-4217, inherited from the property when null
    notes: text('notes'),
    /** Seeded by Pocket Cash. A re-seed never overwrites an existing row. */
    isSystem: boolean('is_system').notNull().default(false),
    enabled: boolean('enabled').notNull().default(true),
    /** Soft delete. Set instead of deleting when a property already uses the type. */
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('cost_types_scope_idx').on(table.scope),
    index('cost_types_category_idx').on(table.category),
  ],
)
