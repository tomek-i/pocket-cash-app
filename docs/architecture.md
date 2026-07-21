# Pocket Cash — Architecture

How Pocket Cash ships **one UI and one codebase** as both a **web app** and an
**offline desktop app**, without building any page, component, or rule twice.

Pocket Cash is **local-only and single-user**: no auth, no accounts, no cloud
services, no telemetry. Everything runs on the user's machine against an embedded,
in-process Postgres. There is no server to deploy and nothing phones home.

---

## 1. The shape

- **One design system, one set of screens, one schema, one query layer.**
- A **web app** and a **desktop app** that are the *same* Next.js app — the
  desktop is an Electron shell that runs that app in-process. Only the thin
  per-platform shell differs.
- Reuse measured in "never write it twice": pages, React Server Components,
  server actions, validation, and queries are shared verbatim.

---

## 2. Layers

```
┌──────────────────────────────────────────────────────────────┐
│  Shells (thin, per-platform)                                   │
│  • apps/web      Next.js 15 App Router (the whole UI + logic)  │
│  • apps/desktop  Electron — runs the SAME Next app in-process  │
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
platform glue (window/process lifecycle, where the database file lives, native
secret storage).

**No separate API layer.** The UI talks to the data through Next **Server Actions**
and **React Server Components** — the function signature is the typed contract, so
there is nothing to document or keep in sync like a REST surface. The only HTTP
route is `/api/health`.

---

## 3. Key decisions

| #   | Decision      | Choice                                                                                              |
| --- | ------------- | --------------------------------------------------------------------------------------------------- |
| 1   | Theme         | **"Citron"** (warm near-black/off-white neutrals + electric citron accent), light + dark pair       |
| 2   | Desktop shell | **Electron running the existing Next.js app in-process** (nothing rebuilt for desktop)              |
| 3   | Data          | **PGlite** — embedded Postgres (WASM), same `pg-core` schema + Drizzle queries                      |
| 4   | Tenancy       | **None** — single local user, no orgs/workspaces/accounts                                           |
| 5   | UI ↔ data     | **Server Actions + RSC**, not a separate API/RPC layer                                              |
| 6   | AI            | **Opt-in, provider-agnostic** (`@repo/ai`, Vercel AI SDK), key stored in the OS keychain on desktop |

### Theme — Citron

Warm near-black / off-white neutrals with an electric citron (yellow-lime, `#e5e52e`)
accent. Money reads as green (`--success`, income) vs soft rose (`--destructive`,
spend). Defined once in `@repo/ui` (`packages/ui/src/styles/globals.css`) as a
coherent light `:root` + dark `.dark` pair with Tailwind v4 `@theme inline` tokens.
The app defaults to dark. Reference mockups live in `pocket-cash-theme.html`.

### Desktop shell — Electron runs Next in-process

The desktop loads the *same* Next.js app — every page and server action is reused.

- **Dev:** Electron loads the running `next dev` at `http://127.0.0.1:3000`.
- **Prod:** `electron-builder` ships the Next **standalone** build as an unpacked
  resource; the main process boots it in-process on an OS-assigned free port and
  loads it locally.

Lives in `apps/desktop`. The main process is split into focused modules —
`logging`, `server` (boot the in-process Next server), `db-reset`, `windows/`
(splash + main), `ipc`, and `secrets` — with `main.ts` as a thin lifecycle
orchestrator. Run `pnpm dev`; package with `pnpm build`.

### Data — PGlite embedded Postgres

The app must run fully offline with no external services, while keeping
**Postgres-grade fuzzy search**.

- **PGlite** is Postgres compiled to WASM, in-process, persisting to a local
  directory. It keeps the exact `pg-core` schema and Drizzle queries
  (`drizzle-orm/pglite`) — no dialect fork.
- Fuzzy transaction search uses the `pg_trgm` (trigram similarity + `GIN` index)
  and `fuzzystrmatch` contrib extensions, registered at construction. A query like
  `WHERE description % $1 ORDER BY similarity(description, $1) DESC` runs against
  the local database with no network.

PGlite must **not** be webpack-bundled (it resolves its wasm/`.tar.gz` assets via
`import.meta.url`). It is imported with a `webpackIgnore` dynamic import in
`@repo/database`, kept out of the bundle via Next `serverExternalPackages`, and is
a direct dependency of `apps/web` so the runtime import resolves from the
standalone build.

---

## 4. Desktop specifics

| Concern    | How                                                                                                                                                                         |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Server     | Next standalone booted in the Electron main process (`apps/desktop/src/server.ts`)                                                                                          |
| Database   | Embedded PGlite under `app.getPath('userData')/pglite` — survives updates/reinstalls                                                                                        |
| Migrations | Applied at request time by the workspace resolver (`apps/web/src/lib/workspace.ts`), memoised process-wide                                                                  |
| Secrets    | AI keys encrypted via Electron `safeStorage` (OS keychain), decrypted into `process.env` for the in-process server — never stored in the DB, never readable by the renderer |
| IPC        | Channel names, payloads, and the secret allowlist are defined once in `@repo/desktop-contract` and shared by preload, main, and the web UI                                  |
| Recovery   | A corrupt PGlite data dir is detected on boot and the UI offers a reset (moves the bad dir aside, relaunches)                                                               |
| Logging    | The main process tees stdout/stderr into `…/logs/pocket-cash.log`; `@repo/logger` feeds it                                                                                  |

⚠️ **Data safety:** the database path derives from `productName`/`appId`. Do **not**
change those in a released app — it would move the path and orphan every existing
user's data.

---

## 5. Conventions

- **Thin shells, fat packages.** Shells do platform glue only; logic lives in
  `packages/*` and is called from the Next server actions / RSCs.
- **One embedded database** — `@repo/database` opens PGlite once per process and
  wires it into the shared `db` singleton (stored on `globalThis` so Next dev's
  multiple module instances agree).
- **Chunk bulk inserts** — PGlite caps bind parameters (~32767); the CSV importer
  inserts in ≤1000-row chunks. Any future bulk insert must chunk too.
- **Add a feature** by adding a server action + RSC in `apps/web` that delegates to
  a `@repo/*` package — no API route, no client-side data fetching layer.

See [csv-import-plan.md](csv-import-plan.md) for the bank/account/transaction model
and the CSV import engine, and [releasing.md](releasing.md) for how versions and
builds are cut.
