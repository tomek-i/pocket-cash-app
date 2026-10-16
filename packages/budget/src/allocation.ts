import {
  BUCKET_DEFINITIONS,
  type BucketKind,
  type BucketShare,
  type BudgetBucketType,
  FULL_SHARE,
  sortShares,
} from './buckets'

/**
 * The dial maths. Every function keeps one invariant: the shares of a plan add
 * up to exactly FULL_SHARE, and the dollar caps add up to exactly the income.
 * Integers throughout, so there is never a stray cent or a 99.99% total.
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

/**
 * Set one bucket's share and rebalance the others so the total stays whole.
 * The others keep their proportions to each other. The new value is rounded to
 * `step` and clamped to the whole income.
 */
export function rebalance(
  shares: readonly BucketShare[],
  type: BudgetBucketType,
  value: number,
  step: number = SHARE_STEP,
): BucketShare[] {
  if (!shares.some((s) => s.type === type)) return [...shares]
  if (shares.length === 1) return [{ type, share: FULL_SHARE }]

  const totalUnits = FULL_SHARE / step
  const units = Math.min(totalUnits, Math.max(0, Math.round(value / step)))
  const others = spread(
    shares.filter((s) => s.type !== type),
    totalUnits - units,
    step,
  )
  return sortShares([...others, { type, share: units * step }])
}

/** Add a bucket at 0%. It takes a share once the user drags it up. */
export function addBucket(shares: readonly BucketShare[], type: BudgetBucketType): BucketShare[] {
  if (shares.some((s) => s.type === type)) return [...shares]
  if (shares.length === 0) return [{ type, share: FULL_SHARE }]
  return sortShares([...shares, { type, share: 0 }])
}

/** Remove a bucket and hand its share to the rest, in proportion. */
export function removeBucket(
  shares: readonly BucketShare[],
  type: BudgetBucketType,
  step: number = SHARE_STEP,
): BucketShare[] {
  const rest = shares.filter((s) => s.type !== type)
  if (rest.length === 0) return []
  return spread(rest, FULL_SHARE / step, step)
}

/** Repair shares that do not add up to the whole (e.g. from a hand-edited backup). */
export function normaliseShares(
  shares: readonly BucketShare[],
  step: number = SHARE_STEP,
): BucketShare[] {
  const sorted = sortShares(shares)
  const total = sorted.reduce((sum, s) => sum + s.share, 0)
  if (total === FULL_SHARE || sorted.length === 0) return sorted
  return spread(sorted, FULL_SHARE / step, step)
}

/** Each bucket's dollar cap, in minor units. The caps add up to the income exactly. */
export function bucketCaps(
  income: number,
  shares: readonly BucketShare[],
): (BucketShare & { cap: number })[] {
  const caps = largestRemainder(
    Math.max(0, Math.round(income)),
    shares.map((s) => s.share),
  )
  const anyShare = shares.some((s) => s.share > 0)
  return shares.map((s, i) => ({ ...s, cap: anyShare ? (caps[i] ?? 0) : 0 }))
}

/** The combined share of every spend, or every save, bucket. */
export function kindShare(shares: readonly BucketShare[], kind: BucketKind): number {
  return shares
    .filter((s) => BUCKET_DEFINITIONS[s.type].kind === kind)
    .reduce((sum, s) => sum + s.share, 0)
}
