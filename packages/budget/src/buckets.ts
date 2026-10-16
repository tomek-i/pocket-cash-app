/**
 * The fixed set of budget buckets.
 *
 * Every budgeting framework names its parts differently ("Fixed costs", "Daily
 * Expenses", "Needs"), but they mean the same few things. The app uses one name
 * per meaning. A user can relabel a bucket ("Fun" for Lifestyle), but its type,
 * and so its kind, never changes.
 *
 * Shares are whole basis points: 10000 is the whole income, 5000 is 50%.
 */

export const BUDGET_BUCKET_TYPES = [
  'essentials',
  'lifestyle',
  'savings',
  'investing',
  'debt',
] as const

export type BudgetBucketType = (typeof BUDGET_BUCKET_TYPES)[number]

/**
 * `spend` buckets are measured by what their categories spend. `save` buckets
 * are measured together, as what is left of the income after spending.
 */
export type BucketKind = 'spend' | 'save'

export interface BucketDefinition {
  label: string
  kind: BucketKind
  description: string
}

export const BUCKET_DEFINITIONS: Record<BudgetBucketType, BucketDefinition> = {
  essentials: {
    label: 'Essentials',
    kind: 'spend',
    description: 'Rent or mortgage, groceries, bills, transport, insurance.',
  },
  lifestyle: {
    label: 'Lifestyle',
    kind: 'spend',
    description: 'Eating out, shopping, hobbies, learning, giving.',
  },
  savings: {
    label: 'Savings',
    kind: 'save',
    description: 'Emergency fund, buffer, holidays, big purchases.',
  },
  investing: {
    label: 'Investing',
    kind: 'save',
    description: 'Shares, ETFs, super top-ups.',
  },
  debt: {
    label: 'Debt paydown',
    kind: 'save',
    description: 'Extra repayments above the minimum.',
  },
}

/** The whole income, in basis points. */
export const FULL_SHARE = 10_000

export function isBudgetBucketType(value: unknown): value is BudgetBucketType {
  return typeof value === 'string' && (BUDGET_BUCKET_TYPES as readonly string[]).includes(value)
}

/** A bucket's share of the income. */
export interface BucketShare {
  type: BudgetBucketType
  share: number
}

/** Shares in the canonical bucket order, so every view lists them the same way. */
export function sortShares<T extends { type: BudgetBucketType }>(shares: readonly T[]): T[] {
  return [...shares].sort(
    (a, b) => BUDGET_BUCKET_TYPES.indexOf(a.type) - BUDGET_BUCKET_TYPES.indexOf(b.type),
  )
}
