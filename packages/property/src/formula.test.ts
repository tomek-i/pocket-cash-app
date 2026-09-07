import { describe, expect, it } from 'vitest'
import { evaluateFormula, validateFormula } from './formula'
import type { CalculationContext } from './types'

const context: CalculationContext = {
  purchasePrice: 1_000_000_00,
  propertyValue: 1_050_000_00,
  loanAmount: 800_000_00,
  deposit: 200_000_00,
  dutiableValue: 1_000_000_00,
  lvr: 0.8,
  interestRate: 0.06,
}

function value(formula: string): number {
  const result = evaluateFormula(formula, context)
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`)
  return result.value
}

function errorCode(formula: string): string {
  const result = evaluateFormula(formula, context)
  if (result.ok) throw new Error(`Expected "${formula}" to fail, got ${result.value}`)
  return result.error.code
}

function rejects(formula: string): boolean {
  return !evaluateFormula(formula, context).ok
}

describe('evaluateFormula', () => {
  it('reads a variable', () => expect(value('loanAmount')).toBe(800_000_00))
  it('parses a plain number', () => expect(value('42')).toBe(42))
  it('parses a decimal', () => expect(value('0.005')).toBe(0.005))

  it('applies a percentage of the loan', () =>
    expect(value('loanAmount * 0.005')).toBeCloseTo(400_000, 4))
  it('applies a percentage of the property value', () =>
    expect(value('propertyValue * 0.001')).toBeCloseTo(105_000, 4))

  it('respects operator precedence', () => expect(value('2 + 3 * 4')).toBe(14))
  it('respects parentheses', () => expect(value('(2 + 3) * 4')).toBe(20))
  it('handles subtraction and division', () =>
    expect(value('(purchasePrice - deposit) / 2')).toBe(400_000_00))
  it('handles modulo', () => expect(value('10 % 3')).toBe(1))
  it('handles unary minus', () => expect(value('-5 + 10')).toBe(5))

  // Numbers in a formula are written plainly. Underscore grouping is a
  // TypeScript nicety and is not part of this grammar.
  it('caps a cost with min()', () => expect(value('min(loanAmount * 0.02, 500000)')).toBe(500_000))
  it('floors a cost with max()', () => expect(value('max(loanAmount * 0.0001, 5000)')).toBe(8_000))
  it('nests calls', () => expect(value('max(min(10, 20), 5)')).toBe(10))

  it('rejects an unknown variable', () =>
    expect(errorCode('councilRate * 2')).toBe('UNKNOWN_VARIABLE'))
  it('rejects an unknown function', () => expect(errorCode('sqrt(4)')).toBe('UNKNOWN_FUNCTION'))
  it('rejects an unbalanced parenthesis', () => expect(errorCode('(2 + 3')).toBe('EXPECTED_TOKEN'))
  it('rejects a trailing operator', () => expect(errorCode('2 +')).toBe('UNEXPECTED_END'))
  it('rejects division by zero', () => expect(errorCode('loanAmount / 0')).toBe('DIVIDE_BY_ZERO'))
  it('rejects modulo by zero', () => expect(errorCode('loanAmount % 0')).toBe('DIVIDE_BY_ZERO'))
  it('rejects an empty formula', () => expect(errorCode('   ')).toBe('EMPTY_FORMULA'))
  it('rejects a stray character', () =>
    expect(errorCode('loanAmount & 2')).toBe('UNEXPECTED_CHARACTER'))
  it('rejects a single-argument min()', () => expect(errorCode('min(5)')).toBe('BAD_ARGUMENTS'))
  it('rejects underscore grouping in a number', () => expect(rejects('1_000')).toBe(true))

  it('does not execute JavaScript', () => {
    // The whole point of the parser: these are rejected as bad input, never run.
    expect(rejects('process.exit(1)')).toBe(true)
    expect(rejects('globalThis')).toBe(true)
    expect(rejects('constructor')).toBe(true)
    expect(rejects('__proto__')).toBe(true)
    expect(rejects('(() => 1)()')).toBe(true)
  })

  it('does not leak prototype properties as variables', () => {
    // The allowlist is an array membership test, not a property lookup, so
    // inherited names are not readable.
    expect(errorCode('toString')).toBe('UNKNOWN_VARIABLE')
    expect(errorCode('valueOf')).toBe('UNKNOWN_VARIABLE')
    expect(errorCode('hasOwnProperty')).toBe('UNKNOWN_VARIABLE')
  })
})

describe('validateFormula', () => {
  it('accepts a valid formula', () => expect(validateFormula('loanAmount * 0.012').ok).toBe(true))
  it('rejects an invalid one', () => expect(validateFormula('nope * 2').ok).toBe(false))
  it('accepts a formula that subtracts two variables', () =>
    expect(validateFormula('purchasePrice - deposit').ok).toBe(true))
})
