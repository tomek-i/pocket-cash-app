import { describe, expect, it } from 'vitest'
import {
  clampPage,
  DEFAULT_PAGE_SIZE,
  GAP,
  pageCount,
  pageRange,
  paginationItems,
  toPageSize,
} from './pagination'

describe('toPageSize', () => {
  it('accepts an offered size', () => {
    expect(toPageSize('100')).toBe(100)
    expect(toPageSize(25)).toBe(25)
  })

  it('falls back for anything not offered', () => {
    // The value comes from the URL, so it is whatever was typed there. A range
    // check would let ?size=100000 through, which is the whole table in one query.
    for (const hostile of ['100000', '0', '-50', 'all', '', undefined, null, '75']) {
      expect(toPageSize(hostile)).toBe(DEFAULT_PAGE_SIZE)
    }
  })

  it('falls back to the stored preference when there is one', () => {
    expect(toPageSize(undefined, 200)).toBe(200)
    expect(toPageSize('nonsense', 200)).toBe(200)
  })
})

describe('pageCount', () => {
  it('counts the pages a result set fills', () => {
    expect(pageCount(100, 25)).toBe(4)
    expect(pageCount(101, 25)).toBe(5)
  })

  it('is always at least one, so the summary line still reads', () => {
    expect(pageCount(0, 50)).toBe(1)
  })
})

describe('clampPage', () => {
  it('keeps a page that exists', () => expect(clampPage(3, 10)).toBe(3))
  it('pulls a page past the end back', () => expect(clampPage(99, 10)).toBe(10))
  it('pulls a page before the start back', () => expect(clampPage(0, 10)).toBe(1))
  it('survives nonsense from the URL', () => expect(clampPage(Number.NaN, 10)).toBe(1))
})

describe('paginationItems', () => {
  it('shows every page when they all fit', () => {
    expect(paginationItems(1, 5)).toEqual([1, 2, 3, 4, 5])
  })

  it('keeps the first and last reachable in one click', () => {
    const items = paginationItems(25, 47)
    expect(items[0]).toBe(1)
    expect(items[items.length - 1]).toBe(47)
  })

  it('marks what it skipped', () => {
    expect(paginationItems(25, 47)).toEqual([1, GAP, 23, 24, 25, 26, 27, GAP, 47])
  })

  it('does not open a gap of one page, which would be wider than the page it hides', () => {
    const items = paginationItems(4, 10)
    expect(items).toEqual([1, 2, 3, 4, 5, 6, GAP, 10])
  })

  /**
   * The width is fixed rather than the span, so the buttons do not move as you
   * page. A control that reflows under the pointer sends the next click to the
   * wrong page, which is the whole complaint this is meant to fix.
   */
  it('keeps the same width at both ends and in the middle', () => {
    const widths = [1, 2, 3, 25, 45, 46, 47].map((page) => paginationItems(page, 47).length)
    expect(new Set(widths).size).toBe(1)
  })

  it('handles a single page', () => {
    expect(paginationItems(1, 1)).toEqual([1])
  })

  it('clamps a page from outside the range before windowing', () => {
    expect(paginationItems(999, 47)).toEqual(paginationItems(47, 47))
  })
})

describe('pageRange', () => {
  it('describes the rows on this page', () => {
    expect(pageRange(3, 50, 1200)).toEqual({ first: 101, last: 150 })
  })

  it('stops at the total on the last page', () => {
    expect(pageRange(5, 50, 201)).toEqual({ first: 201, last: 201 })
  })

  it('is empty for no rows', () => {
    expect(pageRange(1, 50, 0)).toEqual({ first: 0, last: 0 })
  })
})
