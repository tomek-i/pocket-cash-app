/**
 * Seed data for the property feature.
 *
 * Everything exported here is written to the database once, as system records,
 * and is editable from settings afterwards. The engine itself never imports this
 * directory: keeping the split means the calculation code stays jurisdiction
 * agnostic and provably so.
 */

export { type CostCategory, DEFAULT_COST_CATEGORIES } from './categories'
export {
  DEFAULT_RECURRING_COST_TYPES,
  DEFAULT_UPFRONT_COST_TYPES,
  type DefaultCostType,
  type DefaultRecurringCostType,
} from './cost-types'
export {
  DEFAULT_JURISDICTIONS,
  GENERIC_TRANSFER_TAX_LABEL,
  type JurisdictionDefinition,
} from './jurisdictions'
export {
  DEFAULT_RATE_SCHEDULES,
  NSW_TRANSFER_DUTY_2026_27,
  NSW_TRANSFER_DUTY_2026_27_ID,
} from './rate-schedules'
export {
  DEFAULT_CALCULATION_SETTINGS,
  type PropertyCalculationSettings,
} from './settings'
