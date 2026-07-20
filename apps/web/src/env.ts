import {
  type ClientEnv,
  clientEnvSchema,
  parseEnv,
  type ServerEnv,
  serverEnvSchema,
} from '@repo/validation/env'

/**
 * Typed, validated access to environment variables. Validation is LAZY (on
 * first access) rather than at import: this keeps `next build` working while
 * still failing loudly at runtime if a required variable is missing or malformed.
 * The CLI `pnpm env:check` is the build-time guard.
 */

let _serverEnv: ServerEnv | undefined

/** Server-only env. Throws if accessed in a client bundle or when invalid. */
export function serverEnv(): ServerEnv {
  if (typeof window !== 'undefined') {
    throw new Error('serverEnv() must not be called in the browser')
  }
  if (!_serverEnv) _serverEnv = parseEnv(serverEnvSchema, process.env)
  return _serverEnv
}

let _clientEnv: ClientEnv | undefined

/** Public env. Empty for the local-only desktop app — nothing to inline. */
export function clientEnv(): ClientEnv {
  if (!_clientEnv) {
    _clientEnv = parseEnv(clientEnvSchema, {})
  }
  return _clientEnv
}
