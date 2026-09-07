/**
 * A deliberately small expression language for user-configured cost formulas.
 *
 * There is **no `eval` and no `Function`** here, and there never should be:
 * these expressions come from the settings UI, so evaluating them as JavaScript
 * would hand the app's process to whatever gets typed in. Instead this is a
 * hand-written tokeniser and recursive descent parser over an allowlist.
 *
 * Grammar:
 *
 *   expression := term (('+' | '-') term)*
 *   term       := unary (('*' | '/' | '%') unary)*
 *   unary      := '-'? primary
 *   primary    := number | variable | call | '(' expression ')'
 *   call       := ('min' | 'max') '(' expression (',' expression)+ ')'
 *
 * Variables carry the units of {@link CalculationContext}: money variables are
 * minor units, `lvr` and `interestRate` are decimals. So "half a percent of the
 * loan" is `loanAmount * 0.005`.
 *
 * `%` is modulo, not "percent of". Percentages are written as multiplication.
 */

import type { CalculationContext, EngineResult } from './types'
import { fail, ok } from './types'

/** The only identifiers a formula may read. */
export const FORMULA_VARIABLES = [
  'purchasePrice',
  'propertyValue',
  'loanAmount',
  'deposit',
  'dutiableValue',
  'lvr',
  'interestRate',
] as const

export type FormulaVariable = (typeof FORMULA_VARIABLES)[number]

/** The only functions a formula may call. */
export const FORMULA_FUNCTIONS = ['min', 'max'] as const

type TokenType = 'number' | 'identifier' | 'operator' | 'paren' | 'comma'

interface Token {
  type: TokenType
  value: string
  position: number
}

const OPERATORS = new Set(['+', '-', '*', '/', '%'])

function tokenize(source: string): EngineResult<Token[]> {
  const tokens: Token[] = []
  let i = 0

  while (i < source.length) {
    const char = source[i] as string

    if (/\s/.test(char)) {
      i += 1
      continue
    }

    if (/[0-9.]/.test(char)) {
      const start = i
      while (i < source.length && /[0-9.]/.test(source[i] as string)) i += 1
      const value = source.slice(start, i)
      if (!/^\d*\.?\d+$|^\d+\.$/.test(value)) {
        return fail('BAD_NUMBER', `"${value}" is not a valid number.`)
      }
      tokens.push({ type: 'number', value, position: start })
      continue
    }

    if (/[a-zA-Z_]/.test(char)) {
      const start = i
      while (i < source.length && /[a-zA-Z0-9_]/.test(source[i] as string)) i += 1
      tokens.push({ type: 'identifier', value: source.slice(start, i), position: start })
      continue
    }

    if (OPERATORS.has(char)) {
      tokens.push({ type: 'operator', value: char, position: i })
      i += 1
      continue
    }

    if (char === '(' || char === ')') {
      tokens.push({ type: 'paren', value: char, position: i })
      i += 1
      continue
    }

    if (char === ',') {
      tokens.push({ type: 'comma', value: char, position: i })
      i += 1
      continue
    }

    return fail('UNEXPECTED_CHARACTER', `Unexpected "${char}" at position ${i}.`)
  }

  return ok(tokens)
}

class ParseError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message)
  }
}

/**
 * Recursive descent over the token stream. Throws {@link ParseError} internally
 * and is wrapped by {@link evaluateFormula}, so nothing escapes to callers.
 */
class Parser {
  private index = 0

  constructor(
    private readonly tokens: Token[],
    private readonly context: CalculationContext,
  ) {}

  parse(): number {
    const value = this.expression()
    if (this.index < this.tokens.length) {
      const token = this.tokens[this.index] as Token
      throw new ParseError('UNEXPECTED_TOKEN', `Unexpected "${token.value}" in the formula.`)
    }
    return value
  }

  private peek(): Token | undefined {
    return this.tokens[this.index]
  }

  private expression(): number {
    let left = this.term()
    for (;;) {
      const token = this.peek()
      if (!token) break
      if (token.type !== 'operator') break
      if (token.value !== '+' && token.value !== '-') break
      this.index += 1
      const right = this.term()
      left = token.value === '+' ? left + right : left - right
    }
    return left
  }

  private term(): number {
    let left = this.unary()
    for (;;) {
      const token = this.peek()
      if (!token) break
      if (token.type !== 'operator') break
      if (token.value !== '*' && token.value !== '/' && token.value !== '%') break
      this.index += 1
      const right = this.unary()
      if ((token.value === '/' || token.value === '%') && right === 0) {
        throw new ParseError('DIVIDE_BY_ZERO', 'The formula divides by zero.')
      }
      left = token.value === '*' ? left * right : token.value === '/' ? left / right : left % right
    }
    return left
  }

  private unary(): number {
    const token = this.peek()
    if (token && token.type === 'operator' && (token.value === '-' || token.value === '+')) {
      this.index += 1
      const value = this.unary()
      return token.value === '-' ? -value : value
    }
    return this.primary()
  }

  private primary(): number {
    const token = this.peek()
    if (!token) throw new ParseError('UNEXPECTED_END', 'The formula ends unexpectedly.')

    if (token.type === 'number') {
      this.index += 1
      return Number(token.value)
    }

    if (token.type === 'identifier') {
      this.index += 1
      const next = this.peek()
      if (next && next.type === 'paren' && next.value === '(') return this.call(token.value)
      return this.variable(token.value)
    }

    if (token.type === 'paren' && token.value === '(') {
      this.index += 1
      const value = this.expression()
      this.expect(')')
      return value
    }

    throw new ParseError('UNEXPECTED_TOKEN', `Unexpected "${token.value}" in the formula.`)
  }

  private call(name: string): number {
    if (name !== 'min' && name !== 'max') {
      throw new ParseError(
        'UNKNOWN_FUNCTION',
        `"${name}" is not a supported function. Use ${FORMULA_FUNCTIONS.join(' or ')}.`,
      )
    }
    this.expect('(')
    const args: number[] = [this.expression()]
    for (;;) {
      const token = this.peek()
      if (!token) break
      if (token.type !== 'comma') break
      this.index += 1
      args.push(this.expression())
    }
    this.expect(')')
    if (args.length < 2) {
      throw new ParseError('BAD_ARGUMENTS', `${name}() needs at least two arguments.`)
    }
    return name === 'min' ? Math.min(...args) : Math.max(...args)
  }

  private variable(name: string): number {
    if (!(FORMULA_VARIABLES as readonly string[]).includes(name)) {
      throw new ParseError(
        'UNKNOWN_VARIABLE',
        `"${name}" is not available. Use one of: ${FORMULA_VARIABLES.join(', ')}.`,
      )
    }
    return this.context[name as FormulaVariable]
  }

  private expect(value: string): void {
    const token = this.peek()
    if (!token || token.value !== value) {
      throw new ParseError('EXPECTED_TOKEN', `Expected "${value}" in the formula.`)
    }
    this.index += 1
  }
}

/**
 * Evaluate a formula against a calculation context. Returns a typed failure for
 * anything malformed rather than throwing, because the caller is usually
 * rendering a cost row and wants to show the problem inline.
 */
export function evaluateFormula(
  formula: string,
  context: CalculationContext,
): EngineResult<number> {
  if (!formula.trim()) return fail('EMPTY_FORMULA', 'The formula is empty.')

  const tokens = tokenize(formula)
  if (!tokens.ok) return tokens

  try {
    const value = new Parser(tokens.value, context).parse()
    if (!Number.isFinite(value)) {
      return fail('NOT_FINITE', 'The formula did not produce a finite number.')
    }
    return ok(value)
  } catch (error) {
    if (error instanceof ParseError) return fail(error.code, error.message)
    throw error
  }
}

/**
 * Check a formula parses and reads only allowed variables, without caring about
 * the result. Used by the settings UI to validate before saving.
 */
export function validateFormula(formula: string): EngineResult<true> {
  // Distinct non-zero values, so a formula like `a / (b - c)` is not reported as
  // a divide by zero purely because every probe variable was the same.
  const probe: CalculationContext = {
    purchasePrice: 1_000_00,
    propertyValue: 1_100_00,
    loanAmount: 800_00,
    deposit: 200_00,
    dutiableValue: 1_000_00,
    lvr: 0.8,
    interestRate: 0.06,
  }
  const result = evaluateFormula(formula, probe)
  return result.ok ? ok(true) : result
}
