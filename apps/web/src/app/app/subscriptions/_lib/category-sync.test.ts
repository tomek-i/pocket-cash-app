import { describe, expect, it } from 'vitest'
import { type CategoryTarget, matchSource, planCategoryUpdates } from './category-sync'

const netflix = { id: 'netflix', matcher: 'netflix', categoryId: 'entertainment' }
const power = { id: 'power', matcher: 'City Utilities', categoryId: 'utilities' }

function txn(id: string, description: string, categoryId: string | null = null): CategoryTarget {
  return { id, merchant: null, description, categoryId }
}

const never = () => false

describe('matchSource', () => {
  it('prefers the longest matcher', () => {
    const premium = { id: 'premium', matcher: 'netflix premium', categoryId: 'x' }
    expect(matchSource('netflix premium com', [netflix, premium])).toBe(premium)
    expect(matchSource('netflix com', [netflix, premium])).toBe(netflix)
  })
})

describe('planCategoryUpdates', () => {
  it('gives uncategorised matched charges the subscription category', () => {
    const plan = planCategoryUpdates(
      [txn('a', 'NETFLIX.COM 1234'), txn('b', 'CITY UTILITIES - ELECTRIC'), txn('c', 'Coffee')],
      [netflix, power],
      never,
    )
    expect(Object.fromEntries(plan)).toEqual({ entertainment: ['a'], utilities: ['b'] })
  })

  it('keeps a category the user picked by hand', () => {
    const plan = planCategoryUpdates([txn('a', 'NETFLIX.COM', 'gifts')], [netflix], never)
    expect(plan.size).toBe(0)
  })

  it('replaces a category the rule allows, for that subscription only', () => {
    const canReplace = (categoryId: string, source: { id: string }) =>
      categoryId === 'subscriptions' || (source.id === 'netflix' && categoryId === 'old')
    const plan = planCategoryUpdates(
      [
        txn('a', 'NETFLIX.COM', 'subscriptions'),
        txn('b', 'NETFLIX.COM', 'old'),
        txn('c', 'CITY UTILITIES', 'old'),
      ],
      [netflix, power],
      canReplace,
    )
    expect(Object.fromEntries(plan)).toEqual({ entertainment: ['a', 'b'] })
  })

  it('skips subscriptions without a matcher or a category', () => {
    const plan = planCategoryUpdates(
      [txn('a', 'NETFLIX.COM')],
      [
        { ...netflix, categoryId: null },
        { id: 'x', matcher: null, categoryId: 'y' },
      ],
      never,
    )
    expect(plan.size).toBe(0)
  })
})
