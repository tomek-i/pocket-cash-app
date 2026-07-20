/**
 * Account kinds, owned by the app (not any bank). Single source of truth shared
 * by the database enum, validation, and UI — same pattern as ROLES.
 */
export const ACCOUNT_TYPES = [
  'checking',
  'savings',
  'credit_card',
  'cash',
  'investment',
  'loan',
  'other',
] as const

export type AccountType = (typeof ACCOUNT_TYPES)[number]

export function isAccountType(value: unknown): value is AccountType {
  return typeof value === 'string' && (ACCOUNT_TYPES as readonly string[]).includes(value)
}
