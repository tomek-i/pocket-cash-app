/**
 * Nominal typing helper. Use to prevent mixing structurally-identical ids,
 * e.g. `type UserId = Brand<string, 'UserId'>` so an OrgId can't be passed
 * where a UserId is expected.
 */
declare const __brand: unique symbol

export type Brand<T, B extends string> = T & { readonly [__brand]: B }
