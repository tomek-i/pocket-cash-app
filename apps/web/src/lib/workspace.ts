/**
 * Offline desktop runs an in-process PGlite database. Open it + apply migrations
 * exactly once, before the first query. This lives here (a normal server module)
 * rather than the instrumentation hook because Next's `serverExternalPackages`
 * (which keeps PGlite unbundled so its wasm loads correctly) is NOT applied to
 * the instrumentation bundle — bundling PGlite there crashes with
 * ERR_INVALID_ARG_TYPE. Memoised so migrations run once per server process.
 */
async function ensureEmbeddedReady(): Promise<void> {
  if (process.env.DATABASE_DRIVER !== 'embedded') return
  // `runEmbeddedMigrations` memoises process-wide on globalThis, so calling it per
  // request is a cheap no-op after the first — and, crucially, it guarantees the
  // db the app queries is the exact instance migrations initialised, even when
  // Next dev splits this package into separate module copies per route.
  const { runEmbeddedMigrations } = await import('@repo/database/embedded')
  await runEmbeddedMigrations()
}

/** Outcome of preparing the embedded database, for the layout to branch on. */
export type EmbeddedDbStatus = { ok: true } | { ok: false; corrupt: boolean; detail: string }

/**
 * Open + migrate the embedded database, classifying failure instead of throwing.
 * A no-op (ok) when not running embedded. The key case: the WASM Postgres aborts
 * on an unclean/corrupt data dir during boot ("Aborted()") — we flag that as
 * `corrupt` so the UI can offer a reset rather than an opaque error. Any other
 * failure is returned non-corrupt so the caller surfaces it as a real bug.
 */
export async function prepareEmbeddedDatabase(): Promise<EmbeddedDbStatus> {
  if (process.env.DATABASE_DRIVER !== 'embedded') return { ok: true }
  try {
    await ensureEmbeddedReady()
    return { ok: true }
  } catch (error) {
    const detail = error instanceof Error ? (error.stack ?? error.message) : String(error)
    // Emscripten's fatal abort — a corrupt data directory that can't be booted.
    const corrupt = /\baborted?\b|\bpanic\b|database cluster/i.test(detail)
    // The init/migration promises drop themselves from the global memo on failure,
    // so a post-reset relaunch re-attempts cleanly.
    return { ok: false, corrupt, detail }
  }
}
