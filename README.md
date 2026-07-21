# Pocket Cash

**Offline-first personal finance, on your desktop.** Pocket Cash tracks money
across multiple institutions and accounts — import bank statements (per-institution
CSV mapping), categorise and analyse spending, manage recurring subscriptions, run
financial-year and tax reports, and see your net worth.

It runs **entirely on your own machine**: an embedded in-process database, no
sign-in, no cloud services, and **no telemetry** — nothing phones home. Web app and
Electron desktop share **one UI and one codebase**.

**Documentation** ([`docs/`](./docs/)):

- **Architecture** — one UI as web + desktop, embedded PGlite: [`architecture.md`](./docs/architecture.md)
- **Import design** — bank/account/transaction model + CSV importers: [`csv-import-plan.md`](./docs/csv-import-plan.md)
- **Releasing** — automated versioning + Windows builds: [`releasing.md`](./docs/releasing.md)

## Quick start

**Prerequisites:** [Node 22](./.nvmrc) and [pnpm](https://pnpm.io) (`corepack enable`).
Nothing else — no database to install, no accounts to create.

```bash
pnpm install            # install the workspace (downloads the Electron binary)
pnpm dev                # launch the desktop app (Next.js + Electron together)
```

`pnpm dev` starts the web app against an embedded [PGlite](https://pglite.dev)
database (in-process Postgres, migrations applied automatically) and opens the
Electron window pointed at it. Your data lives under the app's per-user data
directory; on first run the database is created for you.

## Build the installer

```bash
pnpm build              # builds the Next.js standalone bundle, then electron-builder
```

Artifacts land in `release/` — a Windows installer (`PocketCash-Setup-<v>.exe`), a
portable `.exe`, and a `.zip`. See [`apps/desktop/README.md`](./apps/desktop/README.md)
for how packaging works. To run or build the **web** app on its own, use
`pnpm dev:web` / `pnpm build:web`.

## Stack

| Layer          | Choice                                                   |
| -------------- | -------------------------------------------------------- |
| Monorepo       | pnpm workspaces + Turborepo                              |
| Desktop shell  | Electron (boots the Next.js standalone server in-process)|
| Framework      | Next.js (App Router) · React 19                          |
| Styling / UI   | Tailwind v4 · shadcn (Radix) + Base UI · Citron theme    |
| Database       | Embedded PGlite (in-process Postgres) · Drizzle ORM      |
| AI (opt-in)    | Vercel AI SDK · bring-your-own-key (Anthropic / OpenAI-compatible) |
| Tooling        | Biome · Vitest · Playwright                              |

## Layout

```
apps/
├── web/                 # Next.js app: the entire finance UI + server actions
└── desktop/             # Electron shell that reuses the web app + @repo/ui
packages/
├── ai/                  # Opt-in, provider-agnostic AI (Vercel AI SDK)
├── csv/                 # CSV parsing + per-institution mapping engine
├── database/            # Drizzle schema, embedded PGlite client, migrations
├── logger/              # Zero-dep structured logger (feeds the desktop file log)
├── shared/              # Cross-cutting utilities
├── types/               # Shared types
├── ui/                  # shadcn (Radix) + Base UI components · Citron theme
├── validation/          # Zod schemas (finance + env)
└── typescript-config/   # Shared tsconfig presets
```

## Architecture notes

- **One UI, two shells.** The desktop app doesn't rebuild anything: `apps/desktop`
  is a thin Electron shell that boots the same Next.js standalone server in-process
  and loads it locally. Every page, component, and server action is shared. See
  [`docs/architecture.md`](./docs/architecture.md).
- **Embedded database.** `packages/database` runs an in-process PGlite Postgres
  (`DATABASE_DRIVER=embedded`); migrations are applied on startup in the workspace
  resolver. There is no external database and no network dependency.
- **Local single-user.** There is no auth, no accounts, and no tenancy — the app is
  a single local user. App-level settings (default currency, AI config) live in a
  one-row `app_settings` table.
- **Logging.** `@repo/logger` writes through `console`; in the packaged app the
  Electron main process tees stdout/stderr into an on-disk log
  (`%APPDATA%/Pocket Cash/logs/pocket-cash.log`), and the in-app **Open logs**
  action opens that folder for easy bug reports.

## AI features (opt-in)

Auto-categorise, spending insights, and a tax-deduction scan are powered by the
Vercel AI SDK and are **off until you add a key**. On the desktop the key is stored
in the OS keychain (via Electron `safeStorage`) through the in-app settings — it is
never written to the database. See `packages/ai`.

## Data & privacy

Everything is local. There is no account, no server, and no analytics or crash
telemetry. Back up or move your data with the export/import feature in **Settings**,
which writes a portable JSON snapshot of your data.

## Testing

- **Unit (Vitest):** pure-logic tests live next to their source as `*.test.ts`
  (e.g. `packages/csv`, `packages/validation`). Run with `pnpm test`.
- **E2E (Playwright):** `apps/web/e2e` is the harness for end-to-end specs;
  `pnpm test:e2e` auto-starts the dev server.

## Common scripts

```bash
pnpm dev          # run the desktop app (web + Electron, embedded DB)
pnpm build        # package the desktop app (installer / portable / zip)
pnpm dev:web      # run the web app on its own in the browser
pnpm typecheck    # typecheck all packages
pnpm lint         # Biome lint + format check
pnpm test         # run unit tests (Vitest)
pnpm db:generate  # generate a migration from schema changes
```

## Releases

Version history lives in [`CHANGELOG.md`](./CHANGELOG.md). Releases are automated via
[release-please](https://github.com/googleapis/release-please): commits to `main`
that follow [Conventional Commits](https://www.conventionalcommits.org/) maintain a
release PR (version bump + changelog); merging it tags the release and builds +
publishes the Windows installer. See [`docs/releasing.md`](./docs/releasing.md).

## License

Pocket Cash is licensed under the [PolyForm Noncommercial License 1.0.0](./LICENSE).

You may use, fork, modify, and share it for **noncommercial purposes only** —
personal use, hobby projects, study, and contributions are all welcome — provided
you keep the copyright and license notices intact. **Commercial use is not
permitted.** Copyright © 2026 Tomek Iwainski. This is a source-available (not
OSI "open source") license.
