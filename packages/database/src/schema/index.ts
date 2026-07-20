import { accounts } from './accounts'
import { banks } from './banks'
import { branches } from './branches'
import { categories } from './categories'
import { csvImports } from './csv-imports'
import { csvMappings } from './csv-mappings'
import { financialSubscriptions } from './financial-subscriptions'
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
export * from './csv-imports'
export * from './csv-mappings'
export * from './enums'
export * from './financial-subscriptions'
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
