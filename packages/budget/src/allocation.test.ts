import { describe, expect, it } from 'vitest'
import {
  addBucket,
  bucketCaps,
  kindShare,
  largestRemainder,
  maxShare,
  normaliseShares,
  removeBucket,
  setShare,
  unallocatedAmount,
  unallocatedShare,
} from './allocation'
import type { BucketShare } from './buckets'

const total = (shares: BucketShare[]) => shares.reduce((sum, s) => sum + s.share, 0)

const balanced: BucketShare[] = [
  { type: 'essentials', share: 5000 },
  { type: 'lifestyle', share: 3000 },
  { type: 'savings', share: 2000 },
]

describe('largestRemainder', () => {
  it('splits exactly when the weights divide evenly', () => {
    expect(largestRemainder(100, [1, 1, 2])).toEqual([25, 25, 50])
  })

  it('always adds up to the total', () => {
    const split = largestRemainder(100, [1, 1, 1])
    expect(split).toEqual([34, 33, 33])
  })

  it('splits evenly when every weight is zero', () => {
    expect(largestRemainder(10, [0, 0])).toEqual([5, 5])
  })

  it('returns nothing for no weights', () => {
    expect(largestRemainder(10, [])).toEqual([])
  })
})

describe('setShare', () => {
  it('lowers one bucket and frees the difference', () => {
    expect(setShare(balanced, 'lifestyle', 2000)).toEqual([
      { type: 'essentials', share: 5000 },
      { type: 'lifestyle', share: 2000 },
      { type: 'savings', share: 2000 },
    ])
  })

  it('never hands freed share to another bucket', () => {
    // Lower Lifestyle, then Essentials: each change stays where it was made.
    const lowered = setShare(setShare(balanced, 'lifestyle', 2000), 'essentials', 4500)
    expect(lowered).toEqual([
      { type: 'essentials', share: 4500 },
      { type: 'lifestyle', share: 2000 },
      { type: 'savings', share: 2000 },
    ])
    expect(unallocatedShare(lowered)).toBe(1500)
  })

  it('raises a bucket only as far as the unallocated share allows', () => {
    const freed = setShare(balanced, 'lifestyle', 2000)
    expect(setShare(freed, 'savings', 9000).find((s) => s.type === 'savings')?.share).toBe(3000)
    expect(total(setShare(freed, 'savings', 9000))).toBe(10_000)
  })

  it('cannot raise anything when the plan is full', () => {
    expect(setShare(balanced, 'essentials', 6000)).toEqual(balanced)
  })

  it('rounds to whole percents and stops at zero', () => {
    expect(setShare(balanced, 'savings', 1549).find((s) => s.type === 'savings')?.share).toBe(1500)
    expect(setShare(balanced, 'savings', -500).find((s) => s.type === 'savings')?.share).toBe(0)
  })

  it('ignores a bucket that is not in the plan', () => {
    expect(setShare(balanced, 'debt', 2000)).toEqual(balanced)
  })
})

describe('maxShare', () => {
  it('is the bucket share plus whatever is unallocated', () => {
    const freed = setShare(balanced, 'lifestyle', 2000)
    expect(maxShare(freed, 'essentials')).toBe(6000)
    expect(maxShare(balanced, 'essentials')).toBe(5000)
  })
})

describe('addBucket', () => {
  it('adds at 0% in bucket order', () => {
    expect(addBucket(balanced, 'investing').map((s) => s.type)).toEqual([
      'essentials',
      'lifestyle',
      'savings',
      'investing',
    ])
    expect(total(addBucket(balanced, 'investing'))).toBe(10_000)
  })

  it('gives the first bucket the whole income', () => {
    expect(addBucket([], 'savings')).toEqual([{ type: 'savings', share: 10_000 }])
  })

  it('does not add a bucket twice', () => {
    expect(addBucket(balanced, 'savings')).toEqual(balanced)
  })
})

describe('removeBucket', () => {
  it('frees the removed share instead of handing it out', () => {
    const result = removeBucket(balanced, 'savings')
    expect(result).toEqual([
      { type: 'essentials', share: 5000 },
      { type: 'lifestyle', share: 3000 },
    ])
    expect(unallocatedShare(result)).toBe(2000)
  })

  it('empties the plan when the last bucket goes', () => {
    expect(removeBucket([{ type: 'essentials', share: 10_000 }], 'essentials')).toEqual([])
  })
})

describe('normaliseShares', () => {
  it('leaves a whole plan alone', () => {
    expect(normaliseShares(balanced)).toEqual(balanced)
  })

  it('leaves a plan under 100% alone', () => {
    const under: BucketShare[] = [
      { type: 'essentials', share: 2500 },
      { type: 'lifestyle', share: 2500 },
    ]
    expect(normaliseShares(under)).toEqual(under)
  })

  it('scales down a plan over 100%', () => {
    const result = normaliseShares([
      { type: 'essentials', share: 9000 },
      { type: 'lifestyle', share: 9000 },
    ])
    expect(result).toEqual([
      { type: 'essentials', share: 5000 },
      { type: 'lifestyle', share: 5000 },
    ])
  })
})

describe('bucketCaps', () => {
  it('turns shares into dollar caps', () => {
    expect(bucketCaps(12_800_00, balanced).map((b) => b.cap)).toEqual([
      6_400_00, 3_840_00, 2_560_00,
    ])
  })

  it('makes the caps add up to the income to the cent', () => {
    const shares: BucketShare[] = [
      { type: 'essentials', share: 3300 },
      { type: 'lifestyle', share: 3300 },
      { type: 'savings', share: 3400 },
    ]
    const caps = bucketCaps(1_000_01, shares)
    expect(caps.reduce((sum, b) => sum + b.cap, 0)).toBe(1_000_01)
  })

  it('caps everything at zero with no income', () => {
    expect(bucketCaps(0, balanced).map((b) => b.cap)).toEqual([0, 0, 0])
  })

  it('leaves the unallocated part out of the caps', () => {
    const freed = setShare(balanced, 'lifestyle', 2000)
    expect(bucketCaps(10_000_00, freed).map((b) => b.cap)).toEqual([5_000_00, 2_000_00, 2_000_00])
    expect(unallocatedAmount(10_000_00, freed)).toBe(1_000_00)
  })

  it('makes caps and unallocated add up to the income to the cent', () => {
    const shares: BucketShare[] = [
      { type: 'essentials', share: 3300 },
      { type: 'lifestyle', share: 3300 },
    ]
    const caps = bucketCaps(1_000_01, shares).reduce((sum, b) => sum + b.cap, 0)
    expect(caps + unallocatedAmount(1_000_01, shares)).toBe(1_000_01)
  })
})

describe('kindShare', () => {
  it('adds up the spend and the save buckets separately', () => {
    const shares: BucketShare[] = [
      { type: 'essentials', share: 5500 },
      { type: 'lifestyle', share: 2500 },
      { type: 'savings', share: 1000 },
      { type: 'investing', share: 1000 },
    ]
    expect(kindShare(shares, 'spend')).toBe(8000)
    expect(kindShare(shares, 'save')).toBe(2000)
  })
})
