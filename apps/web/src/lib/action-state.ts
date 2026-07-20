/**
 * Shared shape returned by finance form server actions. Mirrors the original in
 * the banks actions: `values` echoes the submitted fields so a form can
 * repopulate after a failed submit (React 19 resets uncontrolled inputs once the
 * action returns).
 */
export type ActionState = {
  ok?: boolean
  errors?: Record<string, string[] | undefined>
  values?: Record<string, string>
} | null

/** True for a Postgres unique-constraint violation (SQLSTATE 23505). */
export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === '23505'
  )
}
