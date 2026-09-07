/**
 * Seeded jurisdictions.
 *
 * A jurisdiction carries the local *vocabulary* as well as the local rates. The
 * engine never renders a name, so calling the same charge "Transfer Duty" in
 * NSW, "Stamp Duty Land Tax" in the UK and "State / Local Transfer Tax" in the
 * US is a data change, not a code change.
 *
 * Only Australia / NSW ships as an example. Everything else is created by the
 * user in Settings > Property > Jurisdictions.
 */

import { NSW_TRANSFER_DUTY_2026_27_ID } from './rate-schedules'

export interface JurisdictionDefinition {
  /** Opaque key used to match rate schedules. */
  id: string
  name: string
  /** ISO-3166-1 alpha-2. */
  country: string
  /** Subdivision code, or `null` for a country-wide jurisdiction. */
  region: string | null
  /** ISO-4217. */
  currency: string
  /** What this jurisdiction calls its purchase tax, for display only. */
  transferTaxLabel: string
  /** Default schedule for the transfer tax. */
  transferTaxScheduleId: string | null
}

export const DEFAULT_JURISDICTIONS: JurisdictionDefinition[] = [
  {
    id: 'AU-NSW',
    name: 'Australia / New South Wales',
    country: 'AU',
    region: 'NSW',
    currency: 'AUD',
    transferTaxLabel: 'Transfer Duty',
    transferTaxScheduleId: NSW_TRANSFER_DUTY_2026_27_ID,
  },
]

/** Fallback label when a jurisdiction has not defined its own. */
export const GENERIC_TRANSFER_TAX_LABEL = 'Property Transfer Tax'
