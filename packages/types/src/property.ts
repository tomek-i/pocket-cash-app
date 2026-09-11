/**
 * Property domain vocabulary. Single source of truth shared by the database
 * enums, validation and UI, the same pattern as ACCOUNT_TYPES.
 *
 * The calculation vocabulary (calculation types, bases, frequencies, loan
 * types, rate units) lives in `@repo/property` instead, because the engine owns
 * it and the database enums are built from those tuples directly.
 */

/** Kind of dwelling or land. */
export const PROPERTY_TYPES = [
  'house',
  'apartment',
  'townhouse',
  'land',
  'commercial',
  'other',
] as const

export type PropertyType = (typeof PROPERTY_TYPES)[number]

/** What the property is bought for. Drives whether rental modelling applies. */
export const PROPERTY_USES = ['ownerOccupied', 'investment', 'mixed'] as const

export type PropertyUse = (typeof PROPERTY_USES)[number]

/** Where the property sits in the user's portfolio. */
/**
 * `draft` is a plan with no particular house behind it: somewhere to push prices
 * and deposits around and come back to later. Appended rather than inserted,
 * because adding an enum value at the end is the one form of the migration that
 * needs no reordering of what is already stored.
 */
export const PROPERTY_STATUSES = ['existing', 'planned', 'sold', 'draft'] as const

export type PropertyStatus = (typeof PROPERTY_STATUSES)[number]

/** Whether a cost type is a one-off purchase cost or an ongoing holding cost. */
export const COST_SCOPES = ['upfront', 'recurring'] as const

export type CostScope = (typeof COST_SCOPES)[number]
