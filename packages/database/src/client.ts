import type { PgliteDatabase } from 'drizzle-orm/pglite'
import { schema } from './schema'

/**
 * The database is an embedded, in-process PGlite Postgres — Pocket Cash runs
 * fully offline on the user's own machine, with no external database. The rest of
 * the app imports the typed `db` and never touches the driver; `initEmbeddedDb()`
 * (called once at startup) opens it.
 */
export type Database = PgliteDatabase<typeof schema>

/** Always embedded. Kept as a helper for call sites that branch on driver mode. */
export function isEmbedded(): boolean {
  return true
}

/**
 * The initialized database + its in-flight init promise live on `globalThis`, not
 * in module-local `let`s. Next.js dev/HMR and its per-route bundle splitting can
 * load this module as SEVERAL separate instances — and `@repo/database` is reached
 * by two subpaths (`.` for the `db` proxy, `./embedded` for migrations), which get
 * bundled apart. A module-local singleton then lets the copy that runs migrations
 * differ from the copy the app queries, so the query side sees an uninitialized db
 * ("not initialized" on a route's first compile). A `globalThis` slot is shared by
 * every instance in the process, so they always agree.
 */
const DB_KEY = Symbol.for('pocket-cash.embedded-db')
const DB_INIT_KEY = Symbol.for('pocket-cash.embedded-db-init')
type DbGlobal = typeof globalThis & {
  [DB_KEY]?: Database
  [DB_INIT_KEY]?: Promise<Database>
}
const dbGlobal = globalThis as DbGlobal

export const db: Database = new Proxy({} as Database, {
  get(_target, prop, receiver) {
    const instance = dbGlobal[DB_KEY]
    if (!instance) {
      throw new Error(
        'Embedded (PGlite) database not initialized. Call initEmbeddedDb() (or runEmbeddedMigrations() from "@repo/database/embedded") during startup before querying.',
      )
    }
    return Reflect.get(instance, prop, receiver)
  },
})

export interface EmbeddedDbOptions {
  /**
   * Where PGlite persists. A filesystem path (e.g. Electron's `userData`) keeps
   * data across launches; `memory://` is ephemeral (tests). Falls back to
   * `PGLITE_DATA_DIR`, then `memory://`.
   */
  dataDir?: string
}

/**
 * Initialize the embedded PGlite database and wire it into the shared `db`
 * singleton. Idempotent. PGlite + its contrib extensions are loaded via dynamic
 * import so a bundler (Next) never rewrites their wasm/.tar.gz assets — PGlite
 * resolves those via import.meta.url, which only works unbundled. Call this once
 * during startup (then `runEmbeddedMigrations` from `@repo/database/embedded`).
 */
export async function initEmbeddedDb(options: EmbeddedDbOptions = {}): Promise<Database> {
  const existing = dbGlobal[DB_KEY]
  if (existing) return existing

  // Memoise the in-flight open so concurrent cold-start requests share one PGlite
  // instance instead of racing to open several against the same data dir.
  if (!dbGlobal[DB_INIT_KEY]) {
    const pending = (async () => {
      const { PGlite } = await import(/* webpackIgnore: true */ '@electric-sql/pglite')
      const { pg_trgm } = await import(
        /* webpackIgnore: true */ '@electric-sql/pglite/contrib/pg_trgm'
      )
      const { fuzzystrmatch } = await import(
        /* webpackIgnore: true */ '@electric-sql/pglite/contrib/fuzzystrmatch'
      )
      const { drizzle } = await import('drizzle-orm/pglite')

      const dataDir = options.dataDir ?? process.env.PGLITE_DATA_DIR ?? 'memory://'
      // Extensions must be registered at construction for `CREATE EXTENSION` to
      // find them; pg_trgm powers fuzzy transaction search.
      const client = new PGlite(dataDir, { extensions: { pg_trgm, fuzzystrmatch } })
      await client.waitReady

      const instance = drizzle(client, { schema })
      dbGlobal[DB_KEY] = instance
      return instance
    })()
    // Never cache a rejected attempt — a later call (e.g. after a DB reset) retries.
    pending.catch(() => {
      if (dbGlobal[DB_INIT_KEY] === pending) dbGlobal[DB_INIT_KEY] = undefined
    })
    dbGlobal[DB_INIT_KEY] = pending
  }
  return dbGlobal[DB_INIT_KEY]
}
