import type { RateBracket } from '@repo/property'
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { jurisdictions } from './jurisdictions'

/**
 * A dated, versioned set of progressive brackets for one jurisdiction.
 *
 * Nothing here is transfer-duty specific. `groupKey` says what kind of charge
 * the schedule is ("transfer-duty", "land-tax", "mortgage-registration"), and a
 * bracketed cost type resolves a schedule by jurisdiction + group + date. That
 * is what lets the 2027/28 rates be added alongside the 2026/27 ones instead of
 * replacing them.
 *
 * `brackets` is the engine's `RateBracket[]` verbatim: minimum inclusive,
 * maximum exclusive, `null` maximum on the unlimited final band, money in minor
 * units and rates as decimals. Validate with `validateRateSchedule` before
 * writing, because a bad schedule is silently wrong rather than loudly broken.
 *
 * **Bump `version` whenever the brackets change.** A completed purchase stores
 * the id and version it used, so an edit here must never rewrite an existing
 * calculation.
 */
export const rateSchedules = pgTable(
  'rate_schedules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Stable seed identifier, e.g. `au-nsw-transfer-duty-2026-27`. Null when user-created. */
    key: text('key').unique(),
    name: text('name').notNull(),
    jurisdictionKey: text('jurisdiction_key')
      .notNull()
      .references(() => jurisdictions.key, { onDelete: 'cascade' }),
    /** What kind of charge this schedule is. Matched against `costTypes.rateScheduleGroup`. */
    groupKey: text('group_key').notNull(),
    currency: text('currency').notNull(), // ISO-4217
    effectiveFrom: date('effective_from').notNull(), // inclusive
    effectiveTo: date('effective_to'), // inclusive, null = open ended
    version: integer('version').notNull().default(1),
    brackets: jsonb('brackets').$type<RateBracket[]>().notNull().default([]),
    isSystem: boolean('is_system').notNull().default(false),
    enabled: boolean('enabled').notNull().default(true),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('rate_schedules_jurisdiction_idx').on(table.jurisdictionKey),
    // The lookup the planner does on every calculation: jurisdiction + kind of
    // charge + effective date.
    index('rate_schedules_lookup_idx').on(
      table.jurisdictionKey,
      table.groupKey,
      table.effectiveFrom,
    ),
  ],
)
