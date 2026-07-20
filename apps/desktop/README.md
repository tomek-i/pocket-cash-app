# Pocket Cash — Desktop (Electron)

A thin Electron shell around the **same** Next.js app in `apps/web`. There is one
UI codebase: the desktop reuses every page, component, and server action — and the
shared `@repo/ui` design system (Slate Indigo theme) — with nothing rebuilt. It
runs fully offline against an embedded database, with no auth and no network
dependency.

## How it works

- **Dev** — `main.ts` loads the running `next dev` server at `http://127.0.0.1:3000`.
- **Prod** — `electron-builder` ships the Next.js [standalone](https://nextjs.org/docs/app/api-reference/config/next-config-js/output)
  build as an unpacked resource; `main.ts` binds a free port and boots it
  in-process, then loads it locally.
- **Database** — an embedded [PGlite](https://pglite.dev) Postgres runs in the same
  process (`DATABASE_DRIVER=embedded`). Its data lives under the per-user data dir
  (`%APPDATA%/Pocket Cash`); migrations ship as an unpacked resource and are applied
  on startup.

```
apps/desktop
├── src/main.ts          # thin lifecycle orchestrator (app.whenReady)
├── src/server.ts        # boots the Next standalone server in-process (free port, env)
├── src/logging.ts       # file log + stdout/stderr tee
├── src/db-reset.ts      # corrupt-DB reset sentinel + recovery
├── src/ipc.ts           # registers the main-process IPC handlers
├── src/secrets.ts       # OS-keychain secret vault (Electron safeStorage)
├── src/windows/         # splash + main BrowserWindow
├── src/preload.ts       # contextBridge — safe `window.desktop` API
├── esbuild.mjs          # bundles main/preload → dist/*.cjs
├── scripts/             # flatten-standalone + icon prep (run during build)
└── electron-builder.yml
```

IPC channel names, payload types, and the secret allowlist are defined once in
`@repo/desktop-contract` and shared by `preload.ts`, `ipc.ts`, and the web UI, so the
renderer and main process can't drift.

## Run

```bash
pnpm install            # installs Electron + tooling (downloads the Electron binary)
pnpm dev                # starts web (next dev, embedded DB) + Electron together
```

## Package an installer

```bash
pnpm build              # builds web (standalone), flattens it, then electron-builder
```

Artifacts land in the repo-root `release/`: a Windows installer
(`PocketCash-Setup-<version>.exe`), a portable `PocketCash.exe`, and
`PocketCash-<version>.zip`.

> The packaged build expects the standalone server at
> `resources/web/apps/web/server.js` (produced by `scripts/flatten-standalone.mjs`).
> If a Next.js version changes that layout, adjust `extraResources` in
> `electron-builder.yml` and `startNextServer()` in `src/server.ts` together, and
> verify a packaged build before shipping.

## Notes

- **Fully offline / local-first.** No auth, no cloud, no telemetry. The renderer
  loads the in-process Next server, which talks to the embedded PGlite database.
- **Secrets** (e.g. an AI provider key) are encrypted with the OS keychain via
  Electron `safeStorage` and decrypted into `process.env` for the in-process
  server — never stored in the database. See `src/secrets.ts`.
- **Logging.** The main process tees stdout/stderr into
  `%APPDATA%/Pocket Cash/logs/pocket-cash.log` and captures uncaught
  exceptions/rejections; the in-app **Open logs** button opens that folder. App and
  package code log through `@repo/logger`, which writes to the same stream.
- **Data safety.** `appId` and `productName` in `electron-builder.yml` decide the
  per-user data directory and must stay stable across releases — changing either
  orphans existing users' databases.
