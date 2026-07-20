import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sql } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { type Database, type EmbeddedDbOptions, initEmbeddedDb } from './client'

/**
 * Offline-desktop entrypoint. Kept on a separate export subpath
 * (`@repo/database/embedded`) so the Next.js / Neon build never statically pulls
 * in PGlite or the migrator. The Electron main process imports this at startup.
 */

export interface RunEmbeddedMigrationsOptions extends EmbeddedDbOptions {
  /**
   * Folder containing the Drizzle SQL migrations. Defaults to this package's
   * `drizzle/` dir; the packaged desktop app passes an explicit path (or sets
   * `PGLITE_MIGRATIONS_DIR`) since bundling changes the on-disk layout.
   */
  migrationsFolder?: string
}

function defaultMigrationsFolder(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '../drizzle')
}

// Memoised on `globalThis` (not a module-local) for the same reason as the db
// singleton in client.ts: Next dev can load this module as several instances, and
// the migration path must converge on the one process-wide database. Sharing the
// promise here also means the migrator runs exactly once per process, no matter
// how many module copies or concurrent requests call in.
const MIGRATIONS_KEY = Symbol.for('pocket-cash.embedded-migrations')
type MigrationsGlobal = typeof globalThis & { [MIGRATIONS_KEY]?: Promise<Database> }

/**
 * Bring an offline database up to date: open PGlite, enable the search
 * extensions, and apply all Drizzle migrations. Safe to call on every launch —
 * `CREATE EXTENSION IF NOT EXISTS` and Drizzle's journal make it idempotent, and
 * the result is memoised process-wide so repeat calls are a cheap no-op.
 */
export async function runEmbeddedMigrations(
  options: RunEmbeddedMigrationsOptions = {},
): Promise<Database> {
  const g = globalThis as MigrationsGlobal
  if (!g[MIGRATIONS_KEY]) {
    const pending = (async () => {
      const db = await initEmbeddedDb(options)

      await db.execute(sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`)
      await db.execute(sql`CREATE EXTENSION IF NOT EXISTS fuzzystrmatch`)

      const migrationsFolder =
        options.migrationsFolder ?? process.env.PGLITE_MIGRATIONS_DIR ?? defaultMigrationsFolder()
      await migrate(db, { migrationsFolder })

      return db
    })()
    // Never cache a rejected attempt — a later call (e.g. after a DB reset) retries.
    pending.catch(() => {
      if (g[MIGRATIONS_KEY] === pending) g[MIGRATIONS_KEY] = undefined
    })
    g[MIGRATIONS_KEY] = pending
  }
  return g[MIGRATIONS_KEY]
}

export type { EmbeddedDbOptions } from './client'
export { initEmbeddedDb, isEmbedded } from './client'
