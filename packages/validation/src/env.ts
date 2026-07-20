import { z } from 'zod'

/**
 * Runtime environment schemas for the local-only desktop app. The CLI
 * `pnpm env:check` guards presence before boot; these schemas give the running
 * app *typed, validated* access and fail fast on malformed values. Split into
 * server and client because Next.js only inlines NEXT_PUBLIC_* into the browser
 * bundle.
 *
 * The app runs entirely on the user's machine against an embedded PGlite
 * database — there's no auth, no cloud services, and nothing phones home, so the
 * contract is deliberately tiny.
 */

export const serverEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // Database driver. "embedded" runs in-process PGlite (the desktop default);
  // any other value expects a Postgres connection string in DATABASE_URL.
  DATABASE_DRIVER: z.string().optional(),
  DATABASE_URL: z.string().optional(),
  // Embedded (PGlite) settings — only meaningful when DATABASE_DRIVER=embedded.
  PGLITE_DATA_DIR: z.string().optional(),
  PGLITE_MIGRATIONS_DIR: z.string().optional(),
})
export type ServerEnv = z.infer<typeof serverEnvSchema>

export const clientEnvSchema = z.object({})
export type ClientEnv = z.infer<typeof clientEnvSchema>

/**
 * Parse and validate a record against a schema, throwing a readable error that
 * lists every offending variable at once instead of failing one at a time.
 */
export function parseEnv<T extends z.ZodTypeAny>(
  schema: T,
  source: Record<string, unknown>,
): z.infer<T> {
  const result = schema.safeParse(source)
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n')
    throw new Error(`Invalid environment variables:\n${issues}`)
  }
  return result.data
}
