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
  draft: 'Plan',
}

export const LOAN_TYPE_LABELS: Record<LoanType, string> = {
  principalAndInterest: 'Principal & Interest',
  interestOnly: 'Interest only',
}

/**
 * What LVR means, and what the number is telling you.
 *
 * Written once and shared by the planner and the portfolio page, because the two
 * explaining it differently is how a reader concludes they are different things.
 * The ceiling comes from the calculation defaults rather than a constant: what
 * counts as too much is a lending rule, not a property of the ratio.
 */
export function lvrHelp(maxLvr: number): string {
  const ceiling = `${Math.round(maxLvr * 100)}%`
  return (
    'Loan to value ratio: the loan measured against what the property is worth. ' +
    'Lower is safer, because the gap is the part that is actually yours, so 70% ' +
    'means 30% of the value is your equity. Your configured ceiling is ' +
    `${ceiling}, editable in Settings, Property. Borrowing above a lender's ` +
    'ceiling usually means paying mortgage insurance on top.'
  )
}

/** The same ratio across everything held, which is what a lender reads. */
export function portfolioLvrHelp(maxLvr: number): string {
  const ceiling = `${Math.round(maxLvr * 100)}%`
  return (
    'The same ratio across every property you own: total debt against total ' +
    'value. This is the one a lender looks at when you borrow again, and the ' +
    `headroom before your configured ${ceiling} ceiling is what is left to borrow.`
  )
}
