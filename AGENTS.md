# AGENTS.md

Guidance for AI agents (and humans) contributing to **Pocket Cash**. Read this
first, then follow the linked docs for detail. Keep changes consistent with what is
already here.

> Pocket Cash is a **local-only, offline-first, single-user** personal finance
> **desktop** app. No auth, no accounts, no cloud, no telemetry. Everything runs on
> the user's machine against an embedded, in-process Postgres (PGlite). There is no
> server to deploy and nothing phones home. Do not add auth, cloud services,
> analytics or "call home" behaviour.

## Stack

Turborepo monorepo · **pnpm** (`packageManager` pinned) · **Node** (see `.nvmrc` and
the root `engines` field) · Next.js (App Router) + React · Electron desktop shell ·
**PGlite** embedded Postgres + Drizzle ORM · Tailwind · **Biome** (lint and format) ·
Vitest for unit and integration tests, Playwright for e2e · TypeScript.

Exact versions live in the `package.json` files. Do not restate them here, or this
section needs editing every time a dependency moves.

## Layout

```
apps/
  web       Next.js app: the whole UI + logic (pages, RSCs, server actions)
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
docs/               development, architecture, releasing
```

Architecture, key decisions and desktop specifics live in
**[docs/architecture.md](docs/architecture.md)**. Running, testing and packaging
live in **[docs/development.md](docs/development.md)**.

## Commands

Run from the repo root.

| Task | Command |
| --- | --- |
| Desktop dev (default) | `pnpm dev` |
| Web-only dev | `pnpm dev:web` |
| Build desktop (artifacts land in `./release`) | `pnpm build` |
| Build everything | `pnpm build:all` |
| Lint | `pnpm lint` (`pnpm lint:fix` to autofix) |
| Format | `pnpm format` |
| Typecheck | `pnpm typecheck` |
| Unit and integration tests | `pnpm test` (`pnpm test:watch`) |
| E2E tests | `pnpm test:e2e` |
| Regenerate DB migrations | `pnpm db:generate` |

**Before opening a PR, run `pnpm lint`, `pnpm typecheck` and `pnpm test`.**

## Conventions

- **Thin shells, fat packages.** Shells (`apps/*`) do platform glue only. Real logic
  lives in `packages/*` and is called from Next server actions and RSCs.
- **No separate API layer.** The UI talks to data via **Server Actions** and
  **React Server Components**. The typed function signature *is* the contract. Add a
  feature by adding a server action and RSC in `apps/web` that delegates to a
  `@repo/*` package. Do not add REST or RPC routes, or client-side data fetching.
  The only HTTP route is `/api/health`.
- **One embedded database.** `@repo/database` opens PGlite once per process into a
  shared `db` singleton. PGlite must **not** be webpack-bundled (see the
  architecture doc). Bulk inserts must **chunk** at 1000 rows or fewer, because
  PGlite caps bind parameters at roughly 32767.
- **Code style is Biome**, not ESLint or Prettier. Single quotes, trailing commas,
  semicolons as needed, 2-space indent, 100-character lines. Generated and vendored
  directories (`packages/ui/src/components/ui`, `drizzle`, `.next` and so on) are
  excluded, so do not hand-format or lint them.
- **Match the surrounding code**: naming, comment density and idiom.

## Writing style

This applies to docs, code comments, commit messages and PR descriptions.

- **Do not use em dashes (`—`).** Use a full stop, a comma, a colon, brackets, or
  just rewrite the sentence. This includes commit messages, since `CHANGELOG.md` is
  generated from them and cannot be fixed by hand afterwards.
- **Keep it plain and direct.** Short sentences. Everyday words. Say the thing
  rather than building up to it.
- **Do not restate version numbers** that already live in `package.json`, `.nvmrc`
  or the changelog. Link to the source of truth instead.
- **Only claim what is true.** If something is configured but unused, or partly
  done, say so. A doc that describes a test harness with no tests in it is worse
  than no doc.

## ⚠️ Data safety

The user's database path comes from Electron `productName` and `appId`. **Never
change those in a released app.** It moves the path and orphans every existing
user's data. The same goes for the schema: use migrations, never destructive
rewrites of released tables.

## Branching and PRs

- **Never commit directly to `main`.** Every feature, fix or change, however small,
  goes on its own branch and lands via a pull request.
- **Branch off the latest `main`** and use a descriptive, conventional-style name:
  `feat/tax-scanner`, `fix/csv-empty-import`, `docs/releasing-tweaks`,
  `chore/bump-deps`.
- **Keep branches focused.** One logical change per branch and PR. Do not mix an
  unrelated refactor into a feature branch.
- **Before opening the PR**, rebase or merge the latest `main`, then run
  `pnpm lint`, `pnpm typecheck` and `pnpm test` locally. CI runs the same on the PR.
- **Merge to `main` via PR only.** Merging to `main` is what feeds release-please,
  so `main` must always stay releasable.

## Commits and releases

Releases are **fully automated** via
[release-please](https://github.com/googleapis/release-please), so never hand-edit
versions or `CHANGELOG.md`. This depends entirely on commit messages, so **all
commits must be [Conventional Commits](https://www.conventionalcommits.org/)**:

| Prefix | Bump | Example |
| --- | --- | --- |
| `fix:` | patch | `fix: crash on empty CSV import` |
| `feat:` | minor | `feat: add tax deduction scanner` |
| `feat!:` / `BREAKING CHANGE:` footer | major | `feat!: drop legacy mapping format` |
| `docs:` `refactor:` `perf:` `chore:` `test:` `ci:` `style:` | none | `chore: bump deps` |

Push conventional commits to `main`, and release-please opens or updates a "Release
PR" that bumps the three `package.json` versions and regenerates the changelog.
Merging that PR tags `vX.Y.Z`, creates the GitHub Release, and builds and attaches
the Windows and macOS artifacts. The full flow is in
**[docs/releasing.md](docs/releasing.md)**.

## License

Code is **PolyForm Noncommercial 1.0.0**. Do not introduce dependencies with
incompatible licences without flagging it.
