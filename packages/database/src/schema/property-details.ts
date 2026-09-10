import {
  bigint,
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { costTypes } from './cost-types'
import { properties } from './properties'
import { loanTypeEnum, recurrenceFrequencyEnum } from './property-enums'

/**
 * A loan against a property. One-to-many so a split or second loan can be added
 * later without a migration; the first release uses a single row per property.
 */
export const propertyLoans = pgTable(
  'property_loans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id, { onDelete: 'cascade' }),
    name: text('name'),
    /** Minor units. */
    loanAmount: bigint('loan_amount', { mode: 'number' }).notNull().default(0),
    /** Decimal annual rate, `0.06` is 6%. */
    annualRate: doublePrecision('annual_rate').notNull().default(0),
    termYears: integer('term_years').notNull().default(30),
    loanType: loanTypeEnum('loan_type').notNull().default('principalAndInterest'),
    /** Minor units. Balance in an offset or linked account. */
    offsetBalance: bigint('offset_balance', { mode: 'number' }).notNull().default(0),
    /** Minor units. Establishment and other one-off financing costs. */
    otherFinancingCosts: bigint('other_financing_costs', { mode: 'number' }).notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('property_loans_property_idx').on(table.propertyId)],
)

/**
 * One upfront cost on one property.
 *
 * It **references** a cost type rather than copying its definition, so changing
 * a default flows through while per-property overrides survive untouched.
 *
 * There is no separate "calculation mode" column on purpose. The mode is implied
 * by the data: `overrideValue` set means the user overrode the calculation,
 * `null` means use the calculation. A second column saying the same thing is a
 * second thing that can disagree.
 *
 * `costTypeId` is `restrict` rather than `cascade`: deleting a cost type that a
 * property uses is refused by the database, which is what forces the soft delete
 * the settings UI offers.
 */
export const propertyCosts = pgTable(
  'property_costs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id, { onDelete: 'cascade' }),
    costTypeId: uuid('cost_type_id')
      .notNull()
      .references(() => costTypes.id, { onDelete: 'restrict' }),
    enabled: boolean('enabled').notNull().default(true),
    /** Minor units. The entered amount for a `manual` cost type. */
    manualValue: bigint('manual_value', { mode: 'number' }),
    /** Minor units. User override of the calculated amount. Null means use the calculation. */
    overrideValue: bigint('override_value', { mode: 'number' }),
    /** Minor units. The real amount, once it is known. */
    actualValue: bigint('actual_value', { mode: 'number' }),
    notes: text('notes'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('property_costs_property_type_idx').on(table.propertyId, table.costTypeId),
    index('property_costs_property_idx').on(table.propertyId),
  ],
)

/**
 * A recurring cost of holding a property. Unlike an upfront cost this carries
 * its own name and amount, because holding costs are mostly one-off entries the
 * user types in; `costTypeId` is optional and only links back when the entry
 * came from the seeded catalogue.
 */
export const propertyRecurringCosts = pgTable(
  'property_recurring_costs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id, { onDelete: 'cascade' }),
    costTypeId: uuid('cost_type_id').references(() => costTypes.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    category: text('category').notNull().default('other'),
    /** Minor units, charged at `frequency`. */
    amount: bigint('amount', { mode: 'number' }).notNull().default(0),
    frequency: recurrenceFrequencyEnum('frequency').notNull().default('monthly'),
    /** Times per year, required when `frequency` is `custom`. */
    customPerYear: integer('custom_per_year'),
    enabled: boolean('enabled').notNull().default(true),
    notes: text('notes'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('property_recurring_costs_property_idx').on(table.propertyId)],
)

/** Rental assumptions for an investment property. One row per property. */
export const propertyRentals = pgTable(
  'property_rentals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id, { onDelete: 'cascade' }),
    /** Minor units, at `rentFrequency`. */
    rent: bigint('rent', { mode: 'number' }).notNull().default(0),
    rentFrequency: recurrenceFrequencyEnum('rent_frequency').notNull().default('weekly'),
    rentCustomPerYear: integer('rent_custom_per_year'),
    /** Decimal share of the year empty, `0.02` is roughly one week. */
    vacancyRate: doublePrecision('vacancy_rate').notNull().default(0),
    /** Decimal share of collected rent paid to a manager. */
    managementRate: doublePrecision('management_rate').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('property_rentals_property_idx').on(table.propertyId)],
)

/**
 * The inputs a scenario replaces on the base property. Every field is optional:
 * a scenario is an override set, not a copy, so editing the base property flows
 * into every scenario built on it.
 */
export interface ScenarioOverrides {
  /** Minor units. */
  purchasePrice?: number
  /** Minor units. */
  estimatedMarketValue?: number
  /** Minor units. */
  deposit?: number
  /** Decimal share of the purchase price. */
  depositPercentage?: number
  /** Minor units. */
  loanAmount?: number
  /** Decimal annual rate. */
  annualRate?: number
  termYears?: number
  /** Minor units, at the property's rent frequency. */
  rent?: number
}

/** A named what-if over one property, for side-by-side comparison. */
export const propertyScenarios = pgTable(
  'property_scenarios',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    overrides: jsonb('overrides').$type<ScenarioOverrides>().notNull().default({}),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('property_scenarios_property_idx').on(table.propertyId)],
)

/**
 * Money the user can put towards a purchase, entered by hand.
 *
 * Deliberately NOT read from Pocket Cash accounts. A balance in this app is
 * `openingBalance + sum(imported transactions)`, so it is only as current as the
 * last CSV import, silently low when `openingBalance` was never set, and absent
 * for an account that was never imported. That is fine for reviewing spending
 * and wrong for "do I have the deposit", where a confidently wrong number is
 * worse than an empty field. The planner is a modelling tool and stands alone.
 *
 * `propertyId` is null for funds available to any purchase, which is the usual
 * case, and set when the user earmarks money for one property.
 */
export const propertyAvailableFunds = pgTable(
  'property_available_funds',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    propertyId: uuid('property_id').references(() => properties.id, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    /** Minor units. */
    amount: bigint('amount', { mode: 'number' }).notNull().default(0),
    enabled: boolean('enabled').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('property_available_funds_property_idx').on(table.propertyId)],
)
