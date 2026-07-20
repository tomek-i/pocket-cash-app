import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'
import type { NextConfig } from 'next'

const here = dirname(fileURLToPath(import.meta.url))

// This is a monorepo with a single root .env; Next only auto-loads from the app
// directory, so load the root file here (before the bundler reads process.env,
// which is how NEXT_PUBLIC_* values get inlined).
config({ path: join(here, '../../.env') })

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      // Data import/restore posts a whole backup JSON through a Server Action.
      // Next caps Server Action bodies at 1 MB by default — meaningless for this
      // in-process, local, single-user desktop server (no platform request
      // limits), so lift it generously.
      bodySizeLimit: '512mb',
    },
  },
  // `standalone` produces a self-contained server the Electron desktop app boots
  // in production (apps/desktop). `outputFileTracingRoot` points at the monorepo
  // root so workspace deps are traced into the bundle correctly.
  output: 'standalone',
  outputFileTracingRoot: join(here, '../..'),
  // PGlite (embedded desktop DB) loads its wasm/data via import.meta.url, which
  // only resolves when unbundled. It's a direct dep of this app and imported with
  // a webpackIgnore comment (see @repo/database client), so it's required from
  // node_modules at runtime; listing it here also traces it into the standalone
  // build.
  serverExternalPackages: ['@electric-sql/pglite'],
  // Internal packages ship raw TypeScript; Next transpiles them on demand.
  transpilePackages: [
    '@repo/ai',
    '@repo/database',
    '@repo/desktop-contract',
    '@repo/logger',
    '@repo/shared',
    '@repo/types',
    '@repo/ui',
    '@repo/validation',
  ],
}

export default nextConfig
