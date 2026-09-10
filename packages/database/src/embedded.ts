import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sql } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { type Database, type EmbeddedDbOptions, initEmbeddedDb } from './client'
import { seedPropertyDefaults } from './property-seed'

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
  return join(dirname(fileURLToPath(import.meta.url)), '../drizzle/migrations')
}

// Memoised on `globalThis` (not a module-local) for the same reason as the db
// singleton in client.ts: Next dev can load this module as several instances, and
// the migration path must converge on the one process-wide database. Sharing the
// promise here also means the migrator runs exactly once per process, no matter
// how many module copies or concurrent requests call in.
const MIGRATIONS_KEY = Symbol.for('pocket-cash.embedded-migrations')
type MigrationsGlobal = typeof globalThis & { [MIGRATIONS_KEY]?: Promise<Database> }

/**
 * Thrown when the data directory holds a database our migrations did not build.
 *
 * Recognised by the UI so it can offer a reset, which is the only thing that
 * actually helps here. Distinct from a migration that fails on a database we DID
 * build: that is a bug in the SQL, and offering to delete the user's data to work
 * around our own mistake would be the wrong trade.
 */
export class ForeignDatabaseError extends Error {
  readonly recoverable = true

  constructor(tableCount: number) {
    super(
      `The database in this data directory was not created by this app: it holds ${tableCount} ` +
        'table(s) but no migration history. Applying migrations to it would fail on the first ' +
        'object that already exists. Reset the database to start clean.',
    )
    this.name = 'ForeignDatabaseError'
  }
}

/**
 * Refuse to migrate a database we did not build.
 *
 * Drizzle decides what to apply from its own ledger, so an empty ledger means
 * "apply everything from the start". Against a data directory that already holds
 * a schema, that fails on the first `CREATE TYPE` or `CREATE TABLE` for something
 * already there. The whole run is one transaction, so nothing is left half
 * applied, but the app then fails on every launch with a message about a type
 * that already exists, which says nothing about what to do.
 *
 * Tables but no ledger is the signature of exactly that: a data directory from a
 * build predating the migration history, or one belonging to something else.
 */
export async function assertNotForeign(db: Database): Promise<void> {
  const [tables] = (
    await db.execute(sql`
    SELECT count(*)::int AS count FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  `)
  ).rows as unknown as [{ count: number }]

  if (!tables || tables.count === 0) return

  const [ledger] = (
    await db.execute(sql`
    SELECT count(*)::int AS count FROM information_schema.tables
    WHERE table_schema = 'drizzle' AND table_name = '__drizzle_migrations'
  `)
  ).rows as unknown as [{ count: number }]

  if (ledger && ledger.count > 0) {
    const [applied] = (
      await db.execute(sql`SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations`)
    ).rows as unknown as [{ count: number }]
    if (applied && applied.count > 0) return
  }

  throw new ForeignDatabaseError(tables.count)
}

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

      await assertNotForeign(db)

      const migrationsFolder =
        options.migrationsFolder ?? process.env.PGLITE_MIGRATIONS_DIR ?? defaultMigrationsFolder()
      await migrate(db, { migrationsFolder })

      // System property configuration (jurisdictions, rate schedules, cost
      // catalogue). Insert-only and keyed on stable keys, so this is a no-op
      // after the first launch and never overwrites a user's edits. It runs here
      // so the rows are guaranteed present before the first query, rather than
      // every caller having to remember to seed.
      await seedPropertyDefaults(db)

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
