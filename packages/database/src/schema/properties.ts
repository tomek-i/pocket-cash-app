import type { RateBracket } from '@repo/property'
import {
  bigint,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { jurisdictions } from './jurisdictions'
import { propertyStatusEnum, propertyTypeEnum, propertyUseEnum } from './property-enums'

/**
 * The rate schedule a completed purchase was calculated with, frozen at the
 * moment it was completed.
 *
 * This is the whole of historical integrity in one field. Editing a schedule
 * later, or adding next year's rates, must not change what an already completed
 * purchase says it cost. Storing the id and version alone is not enough, since
 * a user can edit a system schedule in place, so the resolved brackets are
 * copied too.
 */
export interface RateScheduleSnapshot {
  scheduleId: string
  scheduleKey: string | null
  name: string
  version: number
  effectiveFrom: string
  effectiveTo: string | null
  currency: string
  brackets: RateBracket[]
  /** When the snapshot was taken, ISO-8601. */
  takenAt: string
}

/**
 * A property the user owns, is modelling, or has sold.
 *
 * Money is signed minor units. Rates and percentages are decimals, matching the
 * calculation engine: `0.06` is 6%, `0.5` is a half share. Storing rates the way
 * the engine consumes them keeps a conversion step out of every read.
 *
 * The country/region pair picks the jurisdiction, which decides the default
 * rules and what the purchase tax is called. Nothing here assumes Australia.
 */
export const properties = pgTable(
  'properties',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    address: text('address'),
    jurisdictionKey: text('jurisdiction_key').references(() => jurisdictions.key, {
      onDelete: 'set null',
    }),
    country: text('country').notNull(), // ISO-3166-1 alpha-2
    region: text('region'),
    currency: text('currency').notNull(), // ISO-4217
    type: propertyTypeEnum('type').notNull().default('house'),
    intendedUse: propertyUseEnum('intended_use').notNull().default('ownerOccupied'),
    status: propertyStatusEnum('status').notNull().default('planned'),

    /** Minor units. What is being paid, for a planned purchase. */
    purchasePrice: bigint('purchase_price', { mode: 'number' }).notNull().default(0),
    /** Minor units. What it is thought to be worth. LVR is measured against this. */
    estimatedMarketValue: bigint('estimated_market_value', { mode: 'number' }),
    /** Minor units. Today's value of a property already owned. */
    currentValue: bigint('current_value', { mode: 'number' }),
    /** Minor units. What an already owned property originally cost. */
    originalPurchasePrice: bigint('original_purchase_price', { mode: 'number' }),
    /** Decimal share owned, `1` being outright. */
    ownershipShare: doublePrecision('ownership_share').notNull().default(1),

    /** Decides which rate schedule applies. `YYYY-MM-DD`. */
    purchaseDate: date('purchase_date'),
    saleDate: date('sale_date'),
    /** Minor units. */
    salePrice: bigint('sale_price', { mode: 'number' }),
    notes: text('notes'),

    /**
     * Set when the purchase is finalised. Once set, the snapshot below is what
     * the calculation must use, not the live schedules.
     */
    completedAt: timestamp('completed_at', { withTimezone: true }),
    rateScheduleSnapshot: jsonb('rate_schedule_snapshot').$type<RateScheduleSnapshot>(),

    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('properties_status_idx').on(table.status),
    index('properties_jurisdiction_idx').on(table.jurisdictionKey),
  ],
)
