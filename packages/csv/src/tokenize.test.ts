import { describe, expect, it } from 'vitest'
import { detectDelimiter, tokenizeCsv } from './tokenize'

const comma = { delimiter: ',', quote: '"' }

describe('tokenizeCsv', () => {
  it('splits simple rows', () => {
    expect(tokenizeCsv('a,b,c\n1,2,3', comma)).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ])
  })

  it('keeps empty fields', () => {
    expect(tokenizeCsv('a,,c', comma)).toEqual([['a', '', 'c']])
  })

  it('handles a quoted field with an embedded delimiter', () => {
    expect(tokenizeCsv('a,"b,c",d', comma)).toEqual([['a', 'b,c', 'd']])
  })

  it('handles escaped quotes', () => {
    expect(tokenizeCsv('"she said ""hi""",x', comma)).toEqual([['she said "hi"', 'x']])
  })

  it('handles newlines embedded in quotes', () => {
    expect(tokenizeCsv('"line1\nline2",b', comma)).toEqual([['line1\nline2', 'b']])
  })

  it('handles CRLF and a trailing newline', () => {
    expect(tokenizeCsv('a,b\r\n1,2\r\n', comma)).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })

  it('supports a semicolon delimiter', () => {
    expect(tokenizeCsv('a;b;c', { delimiter: ';', quote: '"' })).toEqual([['a', 'b', 'c']])
  })
})

describe('detectDelimiter', () => {
  it('detects comma', () => expect(detectDelimiter('a,b,c\n1,2,3')).toBe(','))
  it('detects semicolon', () => expect(detectDelimiter('a;b;c\n1;2;3')).toBe(';'))
  it('detects tab', () => expect(detectDelimiter('a\tb\tc\n1\t2\t3')).toBe('\t'))
})
