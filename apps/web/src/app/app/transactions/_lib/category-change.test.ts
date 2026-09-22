import { describe, expect, it } from 'vitest'
import { overwritesCategory } from './category-change'

describe('overwritesCategory', () => {
  it('never flags when the category is left alone', () => {
    expect(overwritesCategory('groceries', 'nochange')).toBe(false)
    expect(overwritesCategory(null, 'nochange')).toBe(false)
  })

  it('does not flag filling in an uncategorised row', () => {
    expect(overwritesCategory(null, 'groceries')).toBe(false)
    expect(overwritesCategory(null, 'none')).toBe(false)
  })

  it('does not flag setting the category the row already has', () => {
    expect(overwritesCategory('groceries', 'groceries')).toBe(false)
  })

  it('flags replacing a different category', () => {
    expect(overwritesCategory('dining', 'groceries')).toBe(true)
  })

  it('flags clearing a set category', () => {
    expect(overwritesCategory('groceries', 'none')).toBe(true)
  })
})
