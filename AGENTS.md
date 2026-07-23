# AGENTS.md

Guidance for AI agents (and humans) contributing to **Pocket Cash**. Read this
first, then defer to the linked docs for detail. Keep changes consistent with
what's already here.

> Pocket Cash is a **local-only, offline-first, single-user** personal finance
> **desktop** app. No auth, no accounts, no cloud, no telemetry. Everything runs
> on the user's machine against an embedded, in-process Postgres (PGlite). There
> is no server to deploy and nothing phones home. Do not add auth, cloud
> services, analytics, or "call home" behaviour.

## Stack

Turborepo monorepo · **pnpm** (v10, `packageManager` pinned) · **Node ≥ 24** ·
Next.js 15 (App Router) + React 19 · Electron desktop shell · **PGlite** embedded
Postgres + Drizzle ORM · Tailwind v4 · **Biome** (lint + format) · Vitest (unit/
integration) + Playwright (e2e) · TypeScript.

## Layout

```
apps/
  web       Next.js app — the whole UI + logic (pages, RSCs, server actions)
  desktop   Electron shell that runs the SAME Next app in-process
packages/
  ui                design system + "Citron" theme (@repo/ui)
  database          pg-core schema + Drizzle, embedded PGlite (@repo/database)
  csv               pure CSV import engine (@repo/csv)
  validation        Zod finance schemas (@repo/validation)
  ai                opt-in, provider-agnostic AI, BYO key (@repo/ai)
  logger            zero-dep isomorphic logger (@repo/logger)
  desktop-contract  the desktop↔web IPC contract (@repo/desktop-contract)
  shared / types    utilities + shared types
docs/               architecture, csv-import-plan, releasing
```

Architecture, key decisions, and desktop specifics: **[docs/architecture.md](docs/architecture.md)**.

## Commands

Run from the repo root.

| Task | Command |
| --- | --- |
| Desktop dev (default) | `pnpm dev` |
| Web-only dev | `pnpm dev:web` |
| Build desktop (Windows artifacts → `./release`) | `pnpm build` |
| Build everything | `pnpm build:all` |
| Lint | `pnpm lint` (`pnpm lint:fix` to autofix) |
| Format | `pnpm format` |
| Typecheck | `pnpm typecheck` |
| Unit/integration tests | `pnpm test` (`pnpm test:watch`) |
| E2E tests | `pnpm test:e2e` |
| Regenerate DB migrations | `pnpm db:generate` |

**Before opening a PR, run `pnpm lint`, `pnpm typecheck`, and `pnpm test`.**

## Conventions

- **Thin shells, fat packages.** Shells (`apps/*`) do platform glue only; real
  logic lives in `packages/*` and is called from Next server actions / RSCs.
- **No separate API layer.** The UI talks to data via **Server Actions** and
  **React Server Components** — the typed function signature *is* the contract.
  Add a feature by adding a server action + RSC in `apps/web` that delegates to a
  `@repo/*` package. Don't add REST/RPC routes or client-side data fetching. The
  only HTTP route is `/api/health`.
- **One embedded database.** `@repo/database` opens PGlite once per process into a
  shared `db` singleton. PGlite must **not** be webpack-bundled (see architecture
  doc). Bulk inserts must **chunk** (≤1000 rows) — PGlite caps bind params (~32767).
- **Code style is Biome**, not ESLint/Prettier. Single quotes, trailing commas,
  semicolons as-needed, 2-space indent, 100-char lines. Generated/vendored dirs
  (`packages/ui/src/components/ui`, `drizzle`, `.next`, …) are excluded — don't
  hand-format or lint them.
- **Match the surrounding code** — naming, comment density, and idiom.

## ⚠️ Data safety

The user's database path derives from Electron `productName` / `appId`. **Never
change those in a released app** — it moves the path and orphans every existing
user's data. Same for the schema: migrations only, never destructive rewrites of
released tables.

## Branching & PRs

- **Never commit directly to `main`.** Every feature, fix, or change — however
  small — goes on its own branch and lands via a pull request.
- **Branch off the latest `main`** and use a descriptive, conventional-style name:
  `feat/tax-scanner`, `fix/csv-empty-import`, `docs/releasing-tweaks`,
  `chore/bump-deps`.
- **Keep branches focused** — one logical change per branch/PR. Don't mix an
  unrelated refactor into a feature branch.
- **Before opening the PR:** rebase/merge latest `main`, and run `pnpm lint`,
  `pnpm typecheck`, and `pnpm test` locally. CI runs the same on the PR.
- **Merge to `main` via PR only.** Merging to `main` is what feeds release-please
  (see below), so `main` must always stay releasable.

## Commits & releases

Releases are **fully automated** via [release-please](https://github.com/googleapis/release-please)
— never hand-edit versions or `CHANGELOG.md`. This depends entirely on commit
messages, so **all commits must be [Conventional Commits](https://www.conventionalcommits.org/)**:

| Prefix | Bump | Example |
| --- | --- | --- |
| `fix:` | patch | `fix: crash on empty CSV import` |
| `feat:` | minor | `feat: add tax deduction scanner` |
| `feat!:` / `BREAKING CHANGE:` footer | major | `feat!: drop legacy mapping format` |
| `docs:` `refactor:` `perf:` `chore:` `test:` `ci:` `style:` | none | `chore: bump deps` |

Push conventional commits to `main` → release-please opens/updates a "Release PR"
that bumps the three `package.json` versions and regenerates the changelog →
merging that PR tags `vX.Y.Z`, creates the GitHub Release, and builds + attaches
the Windows installer. Full flow: **[docs/releasing.md](docs/releasing.md)**.

## License

Code is **PolyForm Noncommercial 1.0.0**. Don't introduce dependencies with
incompatible licenses without flagging it.
