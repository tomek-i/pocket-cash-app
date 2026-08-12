# Development

Everything you need to run, test and package Pocket Cash locally. For *how it fits
together*, see [architecture.md](architecture.md); for how releases are cut, see
[releasing.md](releasing.md).

## Prerequisites

[Node](../.nvmrc) (see `.nvmrc`; the workspace requires the major pinned in the root
`package.json` `engines` field) and [pnpm](https://pnpm.io) (`corepack enable`).

Nothing else — no database to install, no accounts to create, no services to run.

## Quick start

```bash
pnpm install            # install the workspace (downloads the Electron binary)
pnpm dev                # launch the desktop app (Next.js + Electron together)
```

`pnpm dev` starts the web app against an embedded [PGlite](https://pglite.dev)
database (in-process Postgres, migrations applied automatically) and opens the
Electron window pointed at it. Your data lives under the app's per-user data
directory; on first run the database is created for you.

To run the **web** app on its own in a browser:

```bash
pnpm dev:web
```

The `:web` scripts set the embedded-database environment themselves
(`DATABASE_DRIVER=embedded`, a local `.pglite` data dir, and the migrations path),
so there is nothing to configure.

## Common scripts

```bash
pnpm dev          # run the desktop app (web + Electron, embedded DB)
pnpm build        # package the desktop app (installer / portable / zip)
pnpm dev:web      # run the web app on its own in the browser
pnpm build:web    # build the web app on its own
pnpm build:all    # turbo run build across every package
pnpm typecheck    # typecheck all packages
pnpm lint         # Biome lint + format check
pnpm test         # run unit tests (Vitest)
pnpm db:generate  # generate a migration from schema changes
```

## Repo layout

```
apps/
├── web/                 # Next.js app: the entire finance UI + server actions
└── desktop/             # Electron shell that reuses the web app + @repo/ui
packages/
├── ai/                  # Opt-in, provider-agnostic AI (Vercel AI SDK)
├── csv/                 # CSV parsing + per-institution mapping engine
├── database/            # Drizzle schema, embedded PGlite client, migrations
├── desktop-contract/    # Zero-dep IPC contract shared by main, preload and web
├── logger/              # Zero-dep structured logger (feeds the desktop file log)
├── shared/              # Cross-cutting utilities
├── types/               # Shared types
├── ui/                  # shadcn (Radix) + Base UI components · Citron theme
├── validation/          # Zod schemas (finance + env)
└── typescript-config/   # Shared tsconfig presets
```

## Stack

| Layer         | Choice                                                              |
| ------------- | ------------------------------------------------------------------- |
| Monorepo      | pnpm workspaces + Turborepo                                         |
| Desktop shell | Electron (boots the Next.js standalone server in-process)           |
| Framework     | Next.js (App Router) · React                                        |
| Styling / UI  | Tailwind · shadcn (Radix) + Base UI · Citron theme                  |
| Database      | Embedded PGlite (in-process Postgres) · Drizzle ORM                 |
| AI (opt-in)   | Vercel AI SDK — Anthropic key, local Ollama, or the Claude Code CLI |
| Tooling       | Biome · Vitest · Playwright                                         |

Exact versions live in the `package.json` files — they are deliberately not
restated here, so this doc doesn't need editing every time a dependency moves.

## Key design points

- **One UI, two shells.** `apps/desktop` doesn't rebuild anything: it boots the same
  Next.js standalone server in-process and loads it locally, so every page,
  component and server action is shared. See [architecture.md](architecture.md).
- **Embedded database.** `packages/database` runs an in-process PGlite Postgres
  (`DATABASE_DRIVER=embedded`); migrations are applied on startup in the workspace
  resolver. No external database, no network dependency.
- **Local single-user.** No auth, no accounts, no tenancy. App-level settings
  (default currency, AI config) live in a one-row `app_settings` table.
- **Logging.** `@repo/logger` writes through `console`; in the packaged app the
  Electron main process tees stdout/stderr into an on-disk log
  (`%APPDATA%/Pocket Cash/logs/pocket-cash.log`), and the in-app **Open logs**
  action opens that folder for bug reports.

## AI features (opt-in)

Auto-categorise, spending insights and a tax-deduction scan run through the Vercel
AI SDK and are **off until you configure a provider**. Three modes are supported
(`packages/ai/src/provider.ts`): an Anthropic API key, a local **Ollama** model
(fully offline), or the **Claude Code CLI** using an existing subscription
(desktop only).

On the desktop the API key is stored in the OS keychain via Electron
`safeStorage` — never in the database.

## Testing

- **Unit (Vitest)** — pure-logic tests live next to their source as `*.test.ts`
  (e.g. `packages/csv`, `packages/validation`). Run with `pnpm test`.
- **End-to-end (Playwright)** — configured but **not yet written**.
  `apps/web/playwright.config.ts` exists and points at `apps/web/e2e`, and
  `pnpm test:e2e` is wired up, but there are currently no spec files, so the
  command runs nothing. Adding the first spec means creating that directory.

## Screenshots

The product screenshots in [`assets/`](assets/) — used by the README and the
landing page — are generated, not hand-taken:

```bash
pnpm dev:web                        # terminal 1
pnpm --filter web screenshots       # terminal 2
```

`apps/web/scripts/capture-screenshots.mjs` re-seeds the demo dataset through the
Settings UI and captures a fixed set of pages at a fixed viewport, so the images
stay consistent. Re-run it when the UI changes and commit the diff. Set `BASE_URL`
if the dev server picked a port other than 3000.

## Building the installer

```bash
pnpm build              # builds the Next.js standalone bundle, then electron-builder
```

Artifacts land in `release/`, for whichever platform you are building **on** —
electron-builder does not cross-compile these:

- **Windows** — an installer (`PocketCash-Setup-<v>.exe`), a portable `.exe`, and a `.zip`.
- **macOS** (Apple Silicon) — `PocketCash-<v>-mac-arm64.dmg` and a matching `.zip`.

Releases build both automatically. See
[`apps/desktop/README.md`](../apps/desktop/README.md) for how packaging works, and
[releasing.md](releasing.md) for the macOS Gatekeeper step — the builds are
unsigned, so a first launch needs an override.
