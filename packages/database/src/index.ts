// Re-export common Drizzle operators so service packages can build queries
// without each adding a direct dependency on drizzle-orm.

export type { SQL } from 'drizzle-orm'
export {
  and,
  asc,
  count,
  desc,
  eq,
  getTableColumns,
  gt,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  max,
  ne,
  or,
  sql,
  sum,
} from 'drizzle-orm'
export { type Database, db } from './client'
export { seedPropertyDefaults, TRANSFER_TAX_GROUP } from './property-seed'
export * from './schema'
export * from './settings-store'
