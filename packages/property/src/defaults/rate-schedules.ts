/**
 * Seeded rate schedules.
 *
 * This is the only place in the package that knows anything about a real
 * jurisdiction, and it is plain data. The engine in `../brackets.ts` reads these
 * exactly as it would read a schedule a user typed into settings.
 *
 * Do not add schedules for future years that have not been published.
 */

import type { RateSchedule } from '../types'

/** Stable id, referenced by the seeded transfer duty cost type. */
export const NSW_TRANSFER_DUTY_2026_27_ID = 'au-nsw-transfer-duty-2026-27'

/**
 * NSW general transfer duty, 2026/27.
 *
 * Published as: 1.25% to $18,000, then $225 + 1.50% over $18,000, $525 + 1.75%
 * over $38,000, $1,662 + 3.50% over $103,000, $11,602 + 4.50% over $387,000, and
 * $52,237 + 5.50% over $1,290,000.
 *
 * Source: https://www.revenue.nsw.gov.au/taxes-duties-levies-royalties/transfer-duty/understanding-transfer-duty/calculate-transfer-duty
 *
 * The published base amounts are whole dollars, so a couple of bands step by up
 * to 50 cents at their boundary (at $103,000 the lower band reaches $1,662.50
 * while the next band starts at $1,662). That is how the table is written, and
 * duty is charged in whole dollars, so it is reproduced here rather than
 * smoothed. Bracket validation checks range continuity, not base continuity, for
 * exactly this reason.
 */
export const NSW_TRANSFER_DUTY_2026_27: RateSchedule = {
  id: NSW_TRANSFER_DUTY_2026_27_ID,
  name: 'NSW Transfer Duty 2026/27',
  jurisdiction: 'AU-NSW',
  country: 'AU',
  region: 'NSW',
  currency: 'AUD',
  effectiveFrom: '2026-07-01',
  effectiveTo: '2027-06-30',
  calculationType: 'bracketed',
  version: 1,
  enabled: true,
  brackets: [
    { minimum: 0, maximum: 1_800_000, baseAmount: 0, rate: 0.0125, rateUnit: 'percentage' },
    {
      minimum: 1_800_000,
      maximum: 3_800_000,
      baseAmount: 22_500,
      rate: 0.015,
      rateUnit: 'percentage',
    },
    {
      minimum: 3_800_000,
      maximum: 10_300_000,
      baseAmount: 52_500,
      rate: 0.0175,
      rateUnit: 'percentage',
    },
    {
      minimum: 10_300_000,
      maximum: 38_700_000,
      baseAmount: 166_200,
      rate: 0.035,
      rateUnit: 'percentage',
    },
    {
      minimum: 38_700_000,
      maximum: 129_000_000,
      baseAmount: 1_160_200,
      rate: 0.045,
      rateUnit: 'percentage',
    },
    {
      minimum: 129_000_000,
      maximum: null,
      baseAmount: 5_223_700,
      rate: 0.055,
      rateUnit: 'percentage',
    },
  ],
}

export const DEFAULT_RATE_SCHEDULES: RateSchedule[] = [NSW_TRANSFER_DUTY_2026_27]
