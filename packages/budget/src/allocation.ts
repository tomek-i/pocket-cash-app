import {
  BUCKET_DEFINITIONS,
  type BucketKind,
  type BucketShare,
  type BudgetBucketType,
  FULL_SHARE,
  sortShares,
} from './buckets'

/**
 * The dial maths. Every function keeps one invariant: the shares of a plan never
 * add up to more than FULL_SHARE. Anything under is unallocated, money the plan
 * has not given a job yet. The dollar caps plus the unallocated amount add up to
 * exactly the income. Integers throughout, so there is never a stray cent.
 */

/** Shares move in whole percents by default. */
export const SHARE_STEP = 100

/**
 * Split `total` into integers proportional to `weights` that add up to exactly
 * `total` (the largest remainder method). When every weight is zero the split is
 * even. Ties go to the earlier entry, so the result is stable.
 */
export function largestRemainder(total: number, weights: readonly number[]): number[] {
  if (weights.length === 0) return []
  const positive = weights.map((w) => Math.max(0, w))
  const sum = positive.reduce((a, b) => a + b, 0)
  const basis = sum > 0 ? positive : positive.map(() => 1)
  const basisSum = sum > 0 ? sum : basis.length

  const exact = basis.map((w) => (total * w) / basisSum)
  const floors = exact.map(Math.floor)
  let left = total - floors.reduce((a, b) => a + b, 0)
  const order = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index)
  for (const { index } of order) {
    if (left <= 0) break
    floors[index] = (floors[index] ?? 0) + 1
    left--
  }
  return floors
}

/** Spread `units` of `step` over the buckets in proportion to their shares. */
function spread(shares: readonly BucketShare[], units: number, step: number): BucketShare[] {
  const split = largestRemainder(
    units,
    shares.map((s) => s.share),
  )
  return shares.map((s, i) => ({ type: s.type, share: (split[i] ?? 0) * step }))
}

/** The share no bucket holds yet. Never negative. */
export function unallocatedShare(shares: readonly BucketShare[]): number {
  return Math.max(0, FULL_SHARE - shares.reduce((sum, s) => sum + s.share, 0))
}

/**
 * The most a bucket can take: its own share plus whatever is unallocated. A dial
 * never takes from another bucket.
 */
export function maxShare(shares: readonly BucketShare[], type: BudgetBucketType): number {
  const own = shares.find((s) => s.type === type)?.share ?? 0
  return own + unallocatedShare(shares)
}

/**
 * Set one bucket's share and leave every other bucket alone. Lowering a bucket
 * frees its share as unallocated. Raising it is capped at what is unallocated,
 * so the total never goes over 100%. The value is rounded to `step`.
 */
export function setShare(
  shares: readonly BucketShare[],
  type: BudgetBucketType,
  value: number,
  step: number = SHARE_STEP,
): BucketShare[] {
  if (!shares.some((s) => s.type === type)) return [...shares]
  const limit = maxShare(shares, type)
  const rounded = Math.round(value / step) * step
  const share = Math.min(limit, Math.max(0, rounded))
  return shares.map((s) => (s.type === type ? { type, share } : s))
}

/** Add a bucket at 0%. It takes a share once the user drags it up. */
export function addBucket(shares: readonly BucketShare[], type: BudgetBucketType): BucketShare[] {
  if (shares.some((s) => s.type === type)) return [...shares]
  if (shares.length === 0) return [{ type, share: FULL_SHARE }]
  return sortShares([...shares, { type, share: 0 }])
}

/** Remove a bucket. Its share becomes unallocated rather than going to the rest. */
export function removeBucket(
  shares: readonly BucketShare[],
  type: BudgetBucketType,
): BucketShare[] {
  return shares.filter((s) => s.type !== type)
}

/**
 * Repair shares that add up to more than the whole (e.g. a hand-edited backup)
 * by scaling them down. A plan under 100% is valid and left alone.
 */
export function normaliseShares(
  shares: readonly BucketShare[],
  step: number = SHARE_STEP,
): BucketShare[] {
  const sorted = sortShares(shares)
  const total = sorted.reduce((sum, s) => sum + s.share, 0)
  if (total <= FULL_SHARE || sorted.length === 0) return sorted
  return spread(sorted, FULL_SHARE / step, step)
}

/**
 * Each bucket's dollar cap, in minor units. The unallocated share is split out
 * alongside the buckets, so the caps plus `unallocatedAmount` are the income.
 */
export function bucketCaps(
  income: number,
  shares: readonly BucketShare[],
): (BucketShare & { cap: number })[] {
  const amounts = largestRemainder(Math.max(0, Math.round(income)), [
    ...shares.map((s) => s.share),
    unallocatedShare(shares),
  ])
  return shares.map((s, i) => ({ ...s, cap: amounts[i] ?? 0 }))
}

/** The part of the income no bucket holds, in minor units. */
export function unallocatedAmount(income: number, shares: readonly BucketShare[]): number {
  const caps = bucketCaps(income, shares).reduce((sum, b) => sum + b.cap, 0)
  return Math.max(0, Math.round(income)) - caps
}

/** The combined share of every spend, or every save, bucket. */
export function kindShare(shares: readonly BucketShare[], kind: BucketKind): number {
  return shares
    .filter((s) => BUCKET_DEFINITIONS[s.type].kind === kind)
    .reduce((sum, s) => sum + s.share, 0)
}
