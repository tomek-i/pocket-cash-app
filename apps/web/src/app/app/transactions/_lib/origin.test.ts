import { describe, expect, it } from 'vitest'
import { parseOrigin, withOrigin } from './origin'

describe('withOrigin', () => {
  it('carries the origin as a query parameter', () => {
    expect(withOrigin('/app/transactions/abc', '/app/transactions?page=7')).toBe(
      '/app/transactions/abc?from=%2Fapp%2Ftransactions%3Fpage%3D7',
    )
  })

  it('leaves the link alone when there is no origin', () => {
    expect(withOrigin('/app/transactions/abc', undefined)).toBe('/app/transactions/abc')
  })

  it('encodes the origin so its own query survives', () => {
    const href = withOrigin('/app/transactions/abc', '/app/transactions?q=coffee&page=2')
    // One "?" in the result: the origin's own is encoded, not left to be parsed
    // as part of the detail page's query.
    expect(href.split('?')).toHaveLength(2)
  })
})

describe('parseOrigin', () => {
  it('reads a list URL back with its filters intact', () => {
    expect(parseOrigin('/app/transactions?page=7&category=none')).toEqual({
      href: '/app/transactions?page=7&category=none',
      label: 'Transactions',
    })
  })

  it('names a report by its year', () => {
    expect(parseOrigin('/app/reports/2025?page=3')).toEqual({
      href: '/app/reports/2025?page=3',
      label: 'FY2025 report',
    })
  })

  it('falls back to the list when nothing was carried', () => {
    // A detail page opened directly or refreshed has no origin, and still needs
    // a working link.
    expect(parseOrigin(undefined)).toEqual({ href: '/app/transactions', label: 'Transactions' })
  })

  it('refuses anything that is not an in-app path', () => {
    // The value comes from the URL, so it is whatever was put there.
    for (const hostile of [
      'https://evil.example',
      '//evil.example',
      '/evil',
      'javascript:alert(1)',
      '',
    ]) {
      expect(parseOrigin(hostile).href).toBe('/app/transactions')
    }
  })

  it('refuses an app-looking path that is really protocol relative', () => {
    expect(parseOrigin('//app/transactions').href).toBe('/app/transactions')
  })
})
