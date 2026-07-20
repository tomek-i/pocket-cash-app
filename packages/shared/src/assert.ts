/** Exhaustiveness guard for switch statements / discriminated unions. */
export function assertNever(value: never, message = 'Unexpected value'): never {
  throw new Error(`${message}: ${String(value)}`)
}

/** Narrowing assertion that throws when a value is null/undefined. */
export function assertExists<T>(
  value: T | null | undefined,
  message = 'Expected value to exist',
): T {
  if (value === null || value === undefined) {
    throw new Error(message)
  }
  return value
}
