# Pocket Cash Architecture

How Pocket Cash ships **one UI and one codebase** as both a **web app** and an
**offline desktop app**, without building any page, component or rule twice.

Pocket Cash is **local-only and single-user**. There is no auth, no accounts, no
cloud services and no telemetry. Everything runs on the user's machine against an
embedded, in-process Postgres. There is no server to deploy and nothing phones
home.

---

## 1. The shape

- One design system, one set of screens, one schema, one query layer.
- The web app and the desktop app are the *same* Next.js app. The desktop is an
  Electron shell that runs that app in-process. Only the thin per-platform shell
  differs.
- Pages, React Server Components, server actions, validation and queries are all
  shared as-is. Nothing gets written twice.

---

## 2. Layers

```
┌──────────────────────────────────────────────────────────────┐
│  Shells (thin, per-platform)                                   │
│  • apps/web      Next.js App Router (the whole UI + logic)     │
│  • apps/desktop  Electron, runs the SAME Next app in-process   │
├──────────────────────────────────────────────────────────────┤
│  UI (shared)                                                   │
│  • @repo/ui      design system + "Citron" theme                │
├──────────────────────────────────────────────────────────────┤
│  Domain packages (shared, framework-light)                     │
│  • @repo/csv         CSV import engine (pure, tested)          │
│  • @repo/validation  Zod finance schemas                       │
│  • @repo/ai          opt-in, provider-agnostic AI (BYO key)    │
│  • @repo/logger      zero-dep isomorphic logger                │
│  • @repo/shared / @repo/types   utilities + shared types       │
│  • @repo/desktop-contract  the desktop↔web IPC contract        │
├──────────────────────────────────────────────────────────────┤
│  Data (one schema, one driver)                                 │
│  • @repo/database   pg-core schema + Drizzle, embedded PGlite  │
└──────────────────────────────────────────────────────────────┘
```

Everything below the shell is identical across platforms. Each shell only does
platform glue: window and process lifecycle, where the database file lives, and
native secret storage.

**There is no separate API layer.** The UI talks to the data through Next **Server
Actions** and **React Server Components**. The function signature is the typed
contract, so there is nothing to document or keep in sync the way a REST surface
would need. The only HTTP route is `/api/health`.

---

## 3. Key decisions

| #   | Decision      | Choice                                                                                         |
| --- | ------------- | ---------------------------------------------------------------------------------------------- |
| 1   | Theme         | **"Citron"**: warm near-black and off-white neutrals with an electric citron accent, in a light and dark pair |
| 2   | Desktop shell | **Electron running the existing Next.js app in-process.** Nothing is rebuilt for desktop       |
| 3   | Data          | **PGlite**, embedded Postgres (WASM), using the same `pg-core` schema and Drizzle queries      |
| 4   | Tenancy       | **None.** A single local user, with no orgs, workspaces or accounts                            |
| 5   | UI to data    | **Server Actions and RSC**, not a separate API or RPC layer                                    |
| 6   | AI            | **Opt-in and provider-agnostic** (`@repo/ai`, Vercel AI SDK). The key is stored in the OS keychain on desktop |

### Theme: Citron

Warm near-black and off-white neutrals with an electric citron (yellow-lime,
`#e5e52e`) accent. Money reads as green (`--success`, income) against soft rose
(`--destructive`, spending). It is defined once in `@repo/ui`
(`packages/ui/src/styles/globals.css`) as a matching light `:root` and dark `.dark`
pair, using Tailwind `@theme inline` tokens. The app defaults to dark. Reference
mockups live in `pocket-cash-theme.html`.

### Desktop shell: Electron runs Next in-process

The desktop loads the *same* Next.js app, so every page and server action is
reused.

- **Dev.** Electron loads the running `next dev` at `http://127.0.0.1:3000`.
- **Prod.** `electron-builder` ships the Next **standalone** build as an unpacked
  resource. The main process boots it in-process on a free port the OS assigns,
  then loads it locally.

This lives in `apps/desktop`. The main process is split into focused modules:
`logging`, `server` (boots the in-process Next server), `db-reset`, `windows/`
(splash and main), `ipc`, and `secrets`. `main.ts` is a thin lifecycle
orchestrator. Run it with `pnpm dev` and package it with `pnpm build`.

### Data: PGlite embedded Postgres

The app has to run fully offline with no external services, while keeping
**Postgres-grade fuzzy search**.

- **PGlite** is Postgres compiled to WASM. It runs in-process and persists to a
  local directory, and it keeps the exact `pg-core` schema and Drizzle queries
  (`drizzle-orm/pglite`), so there is no dialect fork.
- Fuzzy transaction search uses the `pg_trgm` (trigram similarity with a `GIN`
  index) and `fuzzystrmatch` contrib extensions, registered at construction. A
  query like `WHERE description % $1 ORDER BY similarity(description, $1) DESC`
  runs against the local database with no network.

PGlite must **not** be webpack-bundled, because it resolves its wasm and `.tar.gz`
assets via `import.meta.url`. It is imported with a `webpackIgnore` dynamic import
in `@repo/database`, kept out of the bundle via Next `serverExternalPackages`, and
listed as a direct dependency of `apps/web` so the runtime import resolves from the
standalone build.

---

## 4. Desktop specifics

| Concern    | How                                                                                                                                                                        |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Server     | Next standalone booted in the Electron main process (`apps/desktop/src/server.ts`)                                                                                         |
| Database   | Embedded PGlite under `app.getPath('userData')/pglite`, which survives updates and reinstalls                                                                               |
| Migrations | Applied at request time by the workspace resolver (`apps/web/src/lib/workspace.ts`), memoised process-wide                                                                  |
| Secrets    | AI keys encrypted via Electron `safeStorage` (OS keychain) and decrypted into `process.env` for the in-process server. They are never stored in the DB or read by the renderer |
| IPC        | Channel names, payloads and the secret allowlist are defined once in `@repo/desktop-contract` and shared by preload, main and the web UI                                    |
| Recovery   | A corrupt PGlite data dir is detected on boot, and the UI offers a reset that moves the bad dir aside and relaunches                                                        |
| Logging    | The main process tees stdout and stderr into `…/logs/pocket-cash.log`, fed by `@repo/logger`                                                                                |

⚠️ **Data safety.** The database path comes from `productName` and `appId`. Do
**not** change those in a released app. It would move the path and orphan every
existing user's data.

---

## 5. Conventions

- **Thin shells, fat packages.** Shells do platform glue only. Logic lives in
  `packages/*` and is called from the Next server actions and RSCs.
- **One embedded database.** `@repo/database` opens PGlite once per process and
  wires it into the shared `db` singleton, stored on `globalThis` so Next dev's
  multiple module instances agree on one.
- **Chunk bulk inserts.** PGlite caps bind parameters at roughly 32767, so the CSV
  importer inserts in chunks of 1000 rows or fewer. Any future bulk insert has to
  chunk too.
- **Add a feature** by adding a server action and RSC in `apps/web` that delegates
  to a `@repo/*` package. No API route, and no client-side data fetching layer.

See [development.md](development.md) for running, testing and packaging the app,
and [releasing.md](releasing.md) for how versions and builds are cut.
