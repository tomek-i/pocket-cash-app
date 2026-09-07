import type { LoanType } from '@repo/property'
import type { PropertyStatus, PropertyType, PropertyUse } from '@repo/types'

/**
 * Display names for the property enums.
 *
 * These live in their own module, not in the dialog, because a Server Component
 * cannot read a plain object exported from a `'use client'` file: Next replaces
 * such a module with a client reference, and the labels come back empty. The
 * page renders its section headings on the server, so the maps have to sit
 * somewhere both sides can genuinely import.
 */

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  house: 'House',
  apartment: 'Apartment / Unit',
  townhouse: 'Townhouse',
  land: 'Land',
  commercial: 'Commercial',
  other: 'Other',
}

export const PROPERTY_USE_LABELS: Record<PropertyUse, string> = {
  ownerOccupied: 'Owner occupied',
  investment: 'Investment',
  mixed: 'Mixed / Other',
}

export const PROPERTY_STATUS_LABELS: Record<PropertyStatus, string> = {
  existing: 'Existing',
  planned: 'Planned purchase',
  sold: 'Sold',
}

export const LOAN_TYPE_LABELS: Record<LoanType, string> = {
  principalAndInterest: 'Principal & Interest',
  interestOnly: 'Interest only',
}
