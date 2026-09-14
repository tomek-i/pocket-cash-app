import { describe, expect, it } from 'vitest'
import { CATEGORY_ICONS } from './_components/category-icon'
import { DEFAULT_CATEGORIES } from './default-categories'

describe('DEFAULT_CATEGORIES', () => {
  it('names every category once, since the seed insert keys on name', () => {
    const names = DEFAULT_CATEGORIES.map((c) => c.name)
    expect(new Set(names).size).toBe(names.length)
  })

  /**
   * An icon name that is not in the map does not throw, it quietly falls back to
   * the neutral shape, so a typo here would ship as a row of identical icons
   * rather than as an error.
   */
  it('uses icon names the renderer can actually resolve', () => {
    for (const category of DEFAULT_CATEGORIES) {
      expect(CATEGORY_ICONS[category.icon], `${category.name} (${category.icon})`).toBeDefined()
    }
  })

  it('gives each category its own colour, written as a plain hex value', () => {
    const colors = DEFAULT_CATEGORIES.map((c) => c.color)
    for (const color of colors) expect(color).toMatch(/^#[0-9a-f]{6}$/)
    expect(new Set(colors).size).toBe(colors.length)
  })
})
