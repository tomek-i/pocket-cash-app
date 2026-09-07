import { CALCULATION_BASES, CALCULATION_TYPES, FREQUENCIES, LOAN_TYPES } from '@repo/property'
import { COST_SCOPES, PROPERTY_STATUSES, PROPERTY_TYPES, PROPERTY_USES } from '@repo/types'
import { pgEnum } from 'drizzle-orm/pg-core'

/**
 * Property enums.
 *
 * The calculation enums take their labels straight from the `@repo/property`
 * tuples, so a column value is directly assignable to the engine's own union
 * with no mapping layer in between. That is why these labels are camelCase
 * rather than the snake_case used by `account_type`: a translation step between
 * the database and the engine would be one more place for a typo to become a
 * wrong number.
 */

export const propertyTypeEnum = pgEnum('property_type', PROPERTY_TYPES)
export const propertyUseEnum = pgEnum('property_use', PROPERTY_USES)
export const propertyStatusEnum = pgEnum('property_status', PROPERTY_STATUSES)
export const costScopeEnum = pgEnum('cost_scope', COST_SCOPES)

export const costCalculationTypeEnum = pgEnum('cost_calculation_type', CALCULATION_TYPES)
export const calculationBaseEnum = pgEnum('calculation_base', CALCULATION_BASES)
export const recurrenceFrequencyEnum = pgEnum('recurrence_frequency', FREQUENCIES)
export const loanTypeEnum = pgEnum('loan_type', LOAN_TYPES)
