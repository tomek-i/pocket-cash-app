import { accounts } from './accounts'
import { banks } from './banks'
import { branches } from './branches'
import { categories } from './categories'
import { costCategories, costTypes } from './cost-types'
import { csvImports } from './csv-imports'
import { csvMappings } from './csv-mappings'
import { financialSubscriptions } from './financial-subscriptions'
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
import {
  costTypesRelations,
  jurisdictionsRelations,
  propertiesRelations,
  propertyAvailableFundsRelations,
  propertyCostsRelations,
  propertyLoansRelations,
  propertyRecurringCostsRelations,
  propertyRentalsRelations,
  propertyScenariosRelations,
  rateSchedulesRelations,
} from './property-relations'
import { rateSchedules } from './rate-schedules'
import {
  accountsRelations,
  banksRelations,
  branchesRelations,
  categoriesRelations,
  csvImportsRelations,
  csvMappingsRelations,
  financialSubscriptionsRelations,
  tagsRelations,
  transactionsRelations,
  transactionTagsRelations,
} from './relations'
import { appSettings } from './settings'
import { tags, transactionTags } from './tags'
import { transactions } from './transactions'

export * from './accounts'
export * from './banks'
export * from './branches'
export * from './categories'
export * from './cost-types'
export * from './csv-imports'
export * from './csv-mappings'
export * from './enums'
export * from './financial-subscriptions'
export * from './jurisdictions'
export * from './properties'
export * from './property-details'
export * from './property-enums'
export * from './property-relations'
export * from './rate-schedules'
export * from './relations'
export * from './settings'
export * from './tags'
export * from './transactions'

/** Full schema object passed to drizzle() so `db.query.*` and relations work.
 * Relation configs must be included for the relational query API (`with: …`). */
export const schema = {
  appSettings,
  banks,
  branches,
  accounts,
  csvMappings,
  csvImports,
  transactions,
  categories,
  tags,
  transactionTags,
  financialSubscriptions,
  jurisdictions,
  rateSchedules,
  costCategories,
  costTypes,
  properties,
  propertyLoans,
  propertyCosts,
  propertyRecurringCosts,
  propertyRentals,
  propertyScenarios,
  propertyAvailableFunds,
  banksRelations,
  branchesRelations,
  accountsRelations,
  csvMappingsRelations,
  csvImportsRelations,
  transactionsRelations,
  categoriesRelations,
  tagsRelations,
  transactionTagsRelations,
  financialSubscriptionsRelations,
  jurisdictionsRelations,
  rateSchedulesRelations,
  costTypesRelations,
  propertiesRelations,
  propertyLoansRelations,
  propertyCostsRelations,
  propertyRecurringCostsRelations,
  propertyRentalsRelations,
  propertyScenariosRelations,
  propertyAvailableFundsRelations,
}

// Inferred row types — the canonical entity types for the rest of the app.
export type Bank = typeof banks.$inferSelect
export type NewBank = typeof banks.$inferInsert
export type Branch = typeof branches.$inferSelect
export type NewBranch = typeof branches.$inferInsert
export type Account = typeof accounts.$inferSelect
export type NewAccount = typeof accounts.$inferInsert
export type CsvMapping = typeof csvMappings.$inferSelect
export type NewCsvMapping = typeof csvMappings.$inferInsert
export type CsvImport = typeof csvImports.$inferSelect
export type NewCsvImport = typeof csvImports.$inferInsert
export type Transaction = typeof transactions.$inferSelect
export type NewTransaction = typeof transactions.$inferInsert
export type Category = typeof categories.$inferSelect
export type NewCategory = typeof categories.$inferInsert
export type Tag = typeof tags.$inferSelect
export type NewTag = typeof tags.$inferInsert
export type TransactionTag = typeof transactionTags.$inferSelect
export type NewTransactionTag = typeof transactionTags.$inferInsert
export type FinancialSubscription = typeof financialSubscriptions.$inferSelect
export type NewFinancialSubscription = typeof financialSubscriptions.$inferInsert

// Property feature.
export type Jurisdiction = typeof jurisdictions.$inferSelect
export type NewJurisdiction = typeof jurisdictions.$inferInsert
export type RateScheduleRow = typeof rateSchedules.$inferSelect
export type NewRateScheduleRow = typeof rateSchedules.$inferInsert
export type CostCategory = typeof costCategories.$inferSelect
export type NewCostCategory = typeof costCategories.$inferInsert
export type CostType = typeof costTypes.$inferSelect
export type NewCostType = typeof costTypes.$inferInsert
export type Property = typeof properties.$inferSelect
export type NewProperty = typeof properties.$inferInsert
export type PropertyLoan = typeof propertyLoans.$inferSelect
export type NewPropertyLoan = typeof propertyLoans.$inferInsert
export type PropertyCost = typeof propertyCosts.$inferSelect
export type NewPropertyCost = typeof propertyCosts.$inferInsert
export type PropertyRecurringCost = typeof propertyRecurringCosts.$inferSelect
export type NewPropertyRecurringCost = typeof propertyRecurringCosts.$inferInsert
export type PropertyRental = typeof propertyRentals.$inferSelect
export type NewPropertyRental = typeof propertyRentals.$inferInsert
export type PropertyScenario = typeof propertyScenarios.$inferSelect
export type NewPropertyScenario = typeof propertyScenarios.$inferInsert
export type PropertyAvailableFund = typeof propertyAvailableFunds.$inferSelect
export type NewPropertyAvailableFund = typeof propertyAvailableFunds.$inferInsert
