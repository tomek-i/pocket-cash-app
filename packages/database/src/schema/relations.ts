import { relations } from 'drizzle-orm'
import { accounts } from './accounts'
import { banks } from './banks'
import { branches } from './branches'
import { categories } from './categories'
import { csvImports } from './csv-imports'
import { csvMappings } from './csv-mappings'
import { financialSubscriptions } from './financial-subscriptions'
import { tags, transactionTags } from './tags'
import { transactions } from './transactions'

export const banksRelations = relations(banks, ({ many }) => ({
  branches: many(branches),
  accounts: many(accounts),
  mappings: many(csvMappings),
}))

export const branchesRelations = relations(branches, ({ one, many }) => ({
  bank: one(banks, { fields: [branches.bankId], references: [banks.id] }),
  accounts: many(accounts),
}))

export const accountsRelations = relations(accounts, ({ one, many }) => ({
  bank: one(banks, { fields: [accounts.bankId], references: [banks.id] }),
  branch: one(branches, { fields: [accounts.branchId], references: [branches.id] }),
  defaultMapping: one(csvMappings, {
    fields: [accounts.defaultMappingId],
    references: [csvMappings.id],
  }),
  transactions: many(transactions),
  imports: many(csvImports),
}))

export const csvMappingsRelations = relations(csvMappings, ({ one, many }) => ({
  bank: one(banks, { fields: [csvMappings.bankId], references: [banks.id] }),
  imports: many(csvImports),
}))

export const csvImportsRelations = relations(csvImports, ({ one, many }) => ({
  account: one(accounts, { fields: [csvImports.accountId], references: [accounts.id] }),
  mapping: one(csvMappings, { fields: [csvImports.mappingId], references: [csvMappings.id] }),
  transactions: many(transactions),
}))

export const transactionsRelations = relations(transactions, ({ one, many }) => ({
  account: one(accounts, { fields: [transactions.accountId], references: [accounts.id] }),
  import: one(csvImports, { fields: [transactions.importId], references: [csvImports.id] }),
  category: one(categories, { fields: [transactions.categoryId], references: [categories.id] }),
  tags: many(transactionTags),
}))

export const categoriesRelations = relations(categories, ({ many }) => ({
  transactions: many(transactions),
  subscriptions: many(financialSubscriptions),
}))

export const tagsRelations = relations(tags, ({ many }) => ({
  transactionTags: many(transactionTags),
}))

export const transactionTagsRelations = relations(transactionTags, ({ one }) => ({
  transaction: one(transactions, {
    fields: [transactionTags.transactionId],
    references: [transactions.id],
  }),
  tag: one(tags, { fields: [transactionTags.tagId], references: [tags.id] }),
}))

export const financialSubscriptionsRelations = relations(financialSubscriptions, ({ one }) => ({
  category: one(categories, {
    fields: [financialSubscriptions.categoryId],
    references: [categories.id],
  }),
}))
