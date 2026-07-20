import { defineConfig } from 'drizzle-kit'

// Migrations are authored with `pnpm db:generate` (diffs the schema against the
// stored snapshot — no database connection needed) and applied at runtime by
// `runEmbeddedMigrations()` against the embedded PGlite database (see
// ./src/embedded.ts). There is no external database to point drizzle-kit at.
export default defineConfig({
  schema: './src/schema/index.ts',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  strict: true,
  verbose: true,
})
