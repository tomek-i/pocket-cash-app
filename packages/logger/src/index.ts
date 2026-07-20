/**
 * @repo/logger — the one logger for the whole app.
 *
 * Deliberately zero-dependency and built on `console`. That choice does the
 * heavy lifting for free:
 *  - **Desktop:** the Electron main process tees `process.stdout`/`stderr` into
 *    an on-disk log (`%APPDATA%/Pocket Cash/logs/pocket-cash.log`, see
 *    apps/desktop/src/main.ts). Because we write through `console`, every log
 *    line lands in that file automatically — the file logger is our sink.
 *  - **Dev / web:** lines print to the terminal / browser console as usual.
 *  - **Isomorphic:** no `process`/Node APIs are required to *emit*, so the same
 *    logger works in server code, package internals, and client components.
 *
 * There is no transport, no async flush, nothing to configure at a call site.
 * Two knobs, both env vars, read once at import:
 *  - `LOG_LEVEL`  = debug | info | warn | error   (default: debug in dev,
 *                   info in production)
 *  - `LOG_FORMAT` = pretty | json                 (default: pretty)
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

/** Structured fields attached to a log line. `err` is expanded specially. */
export type LogFields = Record<string, unknown> & { err?: unknown }

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 }

/** Read an env var without assuming `process` exists (browser-safe). */
function readEnv(name: string): string | undefined {
  if (typeof process === 'undefined' || !process.env) return undefined
  return process.env[name]
}

const IS_PRODUCTION = readEnv('NODE_ENV') === 'production'

function resolveThreshold(): number {
  const raw = readEnv('LOG_LEVEL')?.toLowerCase()
  if (raw && raw in LEVEL_ORDER) return LEVEL_ORDER[raw as LogLevel]
  return IS_PRODUCTION ? LEVEL_ORDER.info : LEVEL_ORDER.debug
}

const THRESHOLD = resolveThreshold()
const FORMAT: 'pretty' | 'json' = readEnv('LOG_FORMAT') === 'json' ? 'json' : 'pretty'

/** Turn an unknown thrown value into a plain, serialisable shape. */
function serializeError(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack }
  }
  return { value: String(err) }
}

/** Normalise fields: pull `err` out into an expanded, serialisable form. */
function normalizeFields(fields?: LogFields): Record<string, unknown> | undefined {
  if (!fields) return undefined
  const { err, ...rest } = fields
  if (err === undefined) return rest
  return { ...rest, err: serializeError(err) }
}

function formatPretty(
  level: LogLevel,
  scope: string | undefined,
  msg: string,
  fields?: Record<string, unknown>,
): string {
  const time = timestamp()
  const tag = scope ? ` (${scope})` : ''
  let line = `[${time}] ${level.toUpperCase()}${tag} ${msg}`
  if (fields && Object.keys(fields).length > 0) {
    line += ` ${safeStringify(fields)}`
  }
  return line
}

function formatJson(
  level: LogLevel,
  scope: string | undefined,
  msg: string,
  fields?: Record<string, unknown>,
): string {
  return safeStringify({ t: timestamp(), level, scope, msg, ...fields })
}

/** ISO timestamp, guarded so a frozen/odd environment can't break logging. */
function timestamp(): string {
  try {
    return new Date().toISOString()
  } catch {
    return ''
  }
}

/** JSON.stringify that never throws (handles circular refs / BigInt). */
function safeStringify(value: unknown): string {
  const seen = new WeakSet<object>()
  try {
    return JSON.stringify(value, (_key, val) => {
      if (typeof val === 'bigint') return val.toString()
      if (typeof val === 'object' && val !== null) {
        if (seen.has(val)) return '[Circular]'
        seen.add(val)
      }
      return val
    })
  } catch {
    return String(value)
  }
}

/** The console method a level routes to — warnings/errors go to stderr. */
function sinkFor(level: LogLevel): (line: string) => void {
  switch (level) {
    case 'error':
      return (line) => console.error(line)
    case 'warn':
      return (line) => console.warn(line)
    default:
      return (line) => console.log(line)
  }
}

export interface Logger {
  debug(msg: string, fields?: LogFields): void
  info(msg: string, fields?: LogFields): void
  warn(msg: string, fields?: LogFields): void
  error(msg: string, fields?: LogFields): void
  /** Derive a logger with a nested scope, e.g. `log.child('csv')`. */
  child(scope: string): Logger
}

function emit(level: LogLevel, scope: string | undefined, msg: string, fields?: LogFields): void {
  if (LEVEL_ORDER[level] < THRESHOLD) return
  const normalized = normalizeFields(fields)
  const line =
    FORMAT === 'json'
      ? formatJson(level, scope, msg, normalized)
      : formatPretty(level, scope, msg, normalized)
  // Emitting must never throw into the caller's control flow.
  try {
    sinkFor(level)(line)
  } catch {
    // Nothing we can do if even console is unavailable.
  }
}

/**
 * Create a logger. Pass a `scope` (e.g. the package or feature name) so lines
 * are attributable — `createLogger('csv-import')` → `... INFO (csv-import) ...`.
 */
export function createLogger(scope?: string): Logger {
  return {
    debug: (msg, fields) => emit('debug', scope, msg, fields),
    info: (msg, fields) => emit('info', scope, msg, fields),
    warn: (msg, fields) => emit('warn', scope, msg, fields),
    error: (msg, fields) => emit('error', scope, msg, fields),
    child: (childScope) => createLogger(scope ? `${scope}:${childScope}` : childScope),
  }
}

/** The default, unscoped logger. Prefer a scoped child in real modules. */
export const logger = createLogger()
