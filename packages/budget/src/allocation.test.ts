import { describe, expect, it } from 'vitest'
import {
  addBucket,
  bucketCaps,
  kindShare,
  largestRemainder,
  normaliseShares,
  rebalance,
  removeBucket,
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

describe('rebalance', () => {
  it('sets the dragged bucket and keeps the others in proportion', () => {
    // Lifestyle and Savings shared 50% as 3:2. At 40% left over they get 24 and 16.
    expect(rebalance(balanced, 'essentials', 6000)).toEqual([
      { type: 'essentials', share: 6000 },
      { type: 'lifestyle', share: 2400 },
      { type: 'savings', share: 1600 },
    ])
  })

  it('keeps the total at 100% for awkward splits', () => {
    const result = rebalance(balanced, 'essentials', 3300)
    expect(total(result)).toBe(10_000)
    expect(result.every((s) => s.share % 100 === 0)).toBe(true)
  })

  it('rounds to whole percents and clamps to the whole income', () => {
    expect(rebalance(balanced, 'savings', 2049).find((s) => s.type === 'savings')?.share).toBe(2000)
    expect(rebalance(balanced, 'savings', 12_000)).toEqual([
      { type: 'essentials', share: 0 },
      { type: 'lifestyle', share: 0 },
      { type: 'savings', share: 10_000 },
    ])
  })

  it('spreads evenly when the other buckets are all at zero', () => {
    const shares: BucketShare[] = [
      { type: 'essentials', share: 10_000 },
      { type: 'lifestyle', share: 0 },
      { type: 'savings', share: 0 },
    ]
    expect(rebalance(shares, 'essentials', 8000)).toEqual([
      { type: 'essentials', share: 8000 },
      { type: 'lifestyle', share: 1000 },
      { type: 'savings', share: 1000 },
    ])
  })

  it('pins a single bucket at 100%', () => {
    expect(rebalance([{ type: 'essentials', share: 10_000 }], 'essentials', 4000)).toEqual([
      { type: 'essentials', share: 10_000 },
    ])
  })

  it('ignores a bucket that is not in the plan', () => {
    expect(rebalance(balanced, 'debt', 2000)).toEqual(balanced)
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
  it('hands the removed share to the rest in proportion', () => {
    // Essentials and Lifestyle were 5:3. Over 100% that is 62.5 and 37.5, rounded.
    const result = removeBucket(balanced, 'savings')
    expect(result).toEqual([
      { type: 'essentials', share: 6300 },
      { type: 'lifestyle', share: 3700 },
    ])
  })

  it('empties the plan when the last bucket goes', () => {
    expect(removeBucket([{ type: 'essentials', share: 10_000 }], 'essentials')).toEqual([])
  })
})

describe('normaliseShares', () => {
  it('leaves a whole plan alone', () => {
    expect(normaliseShares(balanced)).toEqual(balanced)
  })

  it('scales a plan that does not add up', () => {
    const result = normaliseShares([
      { type: 'essentials', share: 2500 },
      { type: 'lifestyle', share: 2500 },
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
