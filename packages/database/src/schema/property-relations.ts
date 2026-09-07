import { relations } from 'drizzle-orm'
import { accounts } from './accounts'
import { costTypes } from './cost-types'
import { jurisdictions } from './jurisdictions'
import { properties } from './properties'
import {
  propertyAvailableFunds,
  propertyCosts,
  propertyLoans,
  propertyRecurringCosts,
  propertyRentals,
  propertyScenarios,
} from './property-details'
import { rateSchedules } from './rate-schedules'

export const jurisdictionsRelations = relations(jurisdictions, ({ many }) => ({
  rateSchedules: many(rateSchedules),
  properties: many(properties),
}))

export const rateSchedulesRelations = relations(rateSchedules, ({ one }) => ({
  jurisdiction: one(jurisdictions, {
    fields: [rateSchedules.jurisdictionKey],
    references: [jurisdictions.key],
  }),
}))

export const costTypesRelations = relations(costTypes, ({ many }) => ({
  propertyCosts: many(propertyCosts),
  recurringCosts: many(propertyRecurringCosts),
}))

export const propertiesRelations = relations(properties, ({ one, many }) => ({
  jurisdiction: one(jurisdictions, {
    fields: [properties.jurisdictionKey],
    references: [jurisdictions.key],
  }),
  loans: many(propertyLoans),
  costs: many(propertyCosts),
  recurringCosts: many(propertyRecurringCosts),
  rental: many(propertyRentals),
  scenarios: many(propertyScenarios),
  availableFunds: many(propertyAvailableFunds),
}))

export const propertyLoansRelations = relations(propertyLoans, ({ one }) => ({
  property: one(properties, { fields: [propertyLoans.propertyId], references: [properties.id] }),
  account: one(accounts, { fields: [propertyLoans.accountId], references: [accounts.id] }),
}))

export const propertyCostsRelations = relations(propertyCosts, ({ one }) => ({
  property: one(properties, { fields: [propertyCosts.propertyId], references: [properties.id] }),
  costType: one(costTypes, { fields: [propertyCosts.costTypeId], references: [costTypes.id] }),
}))

export const propertyRecurringCostsRelations = relations(propertyRecurringCosts, ({ one }) => ({
  property: one(properties, {
    fields: [propertyRecurringCosts.propertyId],
    references: [properties.id],
  }),
  costType: one(costTypes, {
    fields: [propertyRecurringCosts.costTypeId],
    references: [costTypes.id],
  }),
}))

export const propertyRentalsRelations = relations(propertyRentals, ({ one }) => ({
  property: one(properties, { fields: [propertyRentals.propertyId], references: [properties.id] }),
}))

export const propertyScenariosRelations = relations(propertyScenarios, ({ one }) => ({
  property: one(properties, {
    fields: [propertyScenarios.propertyId],
    references: [properties.id],
  }),
}))

export const propertyAvailableFundsRelations = relations(propertyAvailableFunds, ({ one }) => ({
  property: one(properties, {
    fields: [propertyAvailableFunds.propertyId],
    references: [properties.id],
  }),
  account: one(accounts, { fields: [propertyAvailableFunds.accountId], references: [accounts.id] }),
}))
