/**
 * `@repo/budget`: the budget planner engine.
 *
 * Pure functions over plain data. No database, no React, no I/O. Money is a
 * signed integer in minor units, like `transactions.amount`. Shares are whole
 * basis points (10000 is the whole income).
 */

export {
  addBucket,
  bucketCaps,
  kindShare,
  largestRemainder,
  normaliseShares,
  rebalance,
  removeBucket,
  SHARE_STEP,
} from './allocation'
export {
  BUCKET_DEFINITIONS,
  BUDGET_BUCKET_TYPES,
  type BucketDefinition,
  type BucketKind,
  type BucketShare,
  type BudgetBucketType,
  FULL_SHARE,
  isBudgetBucketType,
  sortShares,
} from './buckets'
export {
  BUDGET_PRESET_IDS,
  BUDGET_PRESETS,
  type BudgetPreset,
  type BudgetPresetId,
  getPreset,
  matchPreset,
  presetShares,
} from './presets'
