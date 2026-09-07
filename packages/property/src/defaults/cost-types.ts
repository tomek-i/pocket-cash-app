/**
 * The seeded cost catalogue.
 *
 * These are **starting records, not a fixed list**. Everything here is written
 * to the database once and is editable, disableable and extendable from
 * Settings > Property > Cost Types. Nothing in the app may special-case an id
 * from this file, or adding a cost stops being a settings change and becomes a
 * code change again.
 *
 * Amounts are AUD minor units and are rough Australian market estimates, meant
 * to be overridden per property.
 */

import type { CostDefinition } from '../cost'
import type { Frequency } from '../types'
import { NSW_TRANSFER_DUTY_2026_27_ID } from './rate-schedules'

/** A seeded cost type, plus the seeding metadata the database needs. */
export interface DefaultCostType extends CostDefinition {
  /** Shown in the Add Cost list by default. */
  enabled: boolean
}

/** Costs paid once, at or before settlement. */
export const DEFAULT_UPFRONT_COST_TYPES: DefaultCostType[] = [
  {
    id: 'transfer-duty',
    name: 'Transfer Duty',
    category: 'government',
    calculationType: 'bracketed',
    calculationBase: 'dutiableValue',
    rateScheduleId: NSW_TRANSFER_DUTY_2026_27_ID,
    enabled: true,
    notes: 'Named per jurisdiction. The schedule decides the amount.',
  },
  {
    id: 'conveyancing',
    name: 'Conveyancing / Legal Fees',
    category: 'legal',
    calculationType: 'fixed',
    defaultValue: 2_000_00,
    enabled: true,
  },
  {
    id: 'building-inspection',
    name: 'Building Inspection',
    category: 'inspection',
    calculationType: 'fixed',
    defaultValue: 600_00,
    enabled: true,
  },
  {
    id: 'pest-inspection',
    name: 'Pest Inspection',
    category: 'inspection',
    calculationType: 'fixed',
    defaultValue: 400_00,
    enabled: true,
  },
  {
    id: 'surveyor',
    name: 'Surveyor',
    category: 'inspection',
    calculationType: 'fixed',
    defaultValue: 800_00,
    enabled: true,
  },
  {
    id: 'strata-report',
    name: 'Strata Report',
    category: 'inspection',
    calculationType: 'fixed',
    defaultValue: 400_00,
    enabled: true,
  },
  {
    id: 'bank-fees',
    name: 'Bank / Loan Fees',
    category: 'financing',
    calculationType: 'fixed',
    defaultValue: 500_00,
    enabled: true,
  },
  {
    id: 'valuation',
    name: 'Valuation',
    category: 'financing',
    calculationType: 'fixed',
    defaultValue: 300_00,
    enabled: true,
  },
  {
    id: 'mortgage-insurance',
    name: 'Mortgage Insurance',
    category: 'insurance',
    calculationType: 'percentage',
    percentage: 0.012,
    calculationBase: 'loanAmount',
    enabled: true,
    notes: 'Only charged above a lender-set LVR. Disable it when it does not apply.',
  },
  {
    id: 'mortgage-registration',
    name: 'Mortgage Registration',
    category: 'registration',
    calculationType: 'fixed',
    defaultValue: 175_00,
    enabled: true,
  },
  {
    id: 'title-registration',
    name: 'Title / Transfer Registration',
    category: 'registration',
    calculationType: 'fixed',
    defaultValue: 175_00,
    enabled: true,
  },
  {
    id: 'initial-insurance',
    name: 'Initial Insurance',
    category: 'insurance',
    calculationType: 'fixed',
    defaultValue: 800_00,
    enabled: true,
  },
  {
    id: 'moving-costs',
    name: 'Moving Costs',
    category: 'moving',
    calculationType: 'fixed',
    defaultValue: 1_500_00,
    enabled: true,
  },
  {
    id: 'initial-repairs',
    name: 'Initial Repairs',
    category: 'renovation',
    calculationType: 'fixed',
    defaultValue: 5_000_00,
    enabled: true,
  },
  {
    id: 'renovations',
    name: 'Renovations',
    category: 'renovation',
    calculationType: 'manual',
    enabled: true,
  },
  {
    id: 'other-upfront',
    name: 'Other',
    category: 'other',
    calculationType: 'manual',
    enabled: true,
  },
]

/** A seeded recurring cost, with the cadence it usually arrives at. */
export interface DefaultRecurringCostType extends DefaultCostType {
  defaultFrequency: Frequency
}

/** Costs of holding the property. Used by the planner's ongoing section. */
export const DEFAULT_RECURRING_COST_TYPES: DefaultRecurringCostType[] = [
  {
    id: 'council-rates',
    name: 'Council / Municipal Rates',
    category: 'government',
    calculationType: 'fixed',
    defaultValue: 400_00,
    defaultFrequency: 'quarterly',
    enabled: true,
  },
  {
    id: 'water-rates',
    name: 'Water',
    category: 'government',
    calculationType: 'fixed',
    defaultValue: 250_00,
    defaultFrequency: 'quarterly',
    enabled: true,
  },
  {
    id: 'building-insurance',
    name: 'Insurance',
    category: 'insurance',
    calculationType: 'fixed',
    defaultValue: 1_400_00,
    defaultFrequency: 'annual',
    enabled: true,
  },
  {
    id: 'strata-levies',
    name: 'Strata / HOA',
    category: 'maintenance',
    calculationType: 'fixed',
    defaultValue: 900_00,
    defaultFrequency: 'quarterly',
    enabled: true,
  },
  {
    id: 'property-management',
    name: 'Property Management',
    category: 'maintenance',
    calculationType: 'manual',
    defaultFrequency: 'monthly',
    enabled: true,
    notes: 'Leave this off when the rental section already applies a management rate.',
  },
  {
    id: 'maintenance',
    name: 'Maintenance',
    category: 'maintenance',
    calculationType: 'fixed',
    defaultValue: 1_000_00,
    defaultFrequency: 'annual',
    enabled: true,
  },
  {
    id: 'gardening',
    name: 'Gardening',
    category: 'maintenance',
    calculationType: 'fixed',
    defaultValue: 60_00,
    defaultFrequency: 'monthly',
    enabled: true,
  },
  {
    id: 'pool',
    name: 'Pool',
    category: 'maintenance',
    calculationType: 'fixed',
    defaultValue: 80_00,
    defaultFrequency: 'monthly',
    enabled: true,
  },
  {
    id: 'land-tax',
    name: 'Land Tax',
    category: 'government',
    calculationType: 'manual',
    defaultFrequency: 'annual',
    enabled: true,
  },
  {
    id: 'repairs',
    name: 'Repairs',
    category: 'maintenance',
    calculationType: 'manual',
    defaultFrequency: 'annual',
    enabled: true,
  },
  {
    id: 'other-recurring',
    name: 'Other',
    category: 'other',
    calculationType: 'manual',
    defaultFrequency: 'monthly',
    enabled: true,
  },
]
