import { describe, expect, it } from 'vitest'
import { initials, slugify, truncate } from './strings'

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Hello World')).toBe('hello-world')
  })
  it('strips diacritics and punctuation', () => {
    expect(slugify('Café Münchën!')).toBe('cafe-munchen')
  })
  it('trims leading/trailing separators', () => {
    expect(slugify('  --Acme, Inc.--  ')).toBe('acme-inc')
  })
})

describe('truncate', () => {
  it('leaves short strings untouched', () => {
    expect(truncate('hello', 10)).toBe('hello')
  })
  it('adds an ellipsis when cut', () => {
    expect(truncate('hello world', 5)).toBe('hell…')
  })
})

describe('initials', () => {
  it('handles single and multi-word names', () => {
    expect(initials('Ada')).toBe('AD')
    expect(initials('Ada Lovelace')).toBe('AL')
    expect(initials('  ')).toBe('?')
  })
})
