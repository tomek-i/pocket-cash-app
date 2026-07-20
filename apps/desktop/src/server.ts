import { connect, createServer } from 'node:net'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { app } from 'electron'
import { performPendingDbReset } from './db-reset'
import { logStartup } from './logging'

// One source of truth for the UI: in dev we load the running `next dev` server,
// in prod we boot the Next.js *standalone* build (the exact same pages + server
// actions as the web app) inside this process. Nothing is rebuilt for desktop.
export const HOST = '127.0.0.1'

// The port isn't fixed: in production we bind an OS-assigned free port (see
// startNextServer) so the app never clashes with a dev server, another copy of
// itself, or anything else already on 3000. In dev we attach to the running
// `next dev` server, which is on 3000. `appUrl`/`startUrl` are derived from it
// and updated once the port is known — everything downstream reads these.
let port = Number(process.env.PORT ?? 3000)
let appUrl = `http://${HOST}:${port}`
// The desktop shell runs fully local/offline with no auth, so it lands straight
// on the dashboard.
let startUrl = `${appUrl}/app`

export function getAppUrl(): string {
  return appUrl
}

export function getStartUrl(): string {
  return startUrl
}

function setPort(p: number): void {
  port = p
  appUrl = `http://${HOST}:${port}`
  startUrl = `${appUrl}/app`
}

// Ask the OS for a free ephemeral port by binding port 0, then release it. There's
// a tiny window between closing this probe and the Next server binding, but the
// server binds immediately after, so a collision is effectively impossible for a
// single desktop app.
function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer()
    probe.unref()
    probe.on('error', reject)
    probe.listen(0, HOST, () => {
      const addr = probe.address()
      const p = typeof addr === 'object' && addr ? addr.port : 0
      probe.close(() => resolve(p))
    })
  })
}

function waitForPort(port: number, host: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = connect(port, host)
      socket.once('connect', () => {
        socket.destroy()
        resolve()
      })
      socket.once('error', () => {
        socket.destroy()
        if (Date.now() > deadline) {
          reject(new Error(`Timed out waiting for ${host}:${port}`))
        } else {
          setTimeout(attempt, 200)
        }
      })
    }
    attempt()
  })
}

export async function startNextServer(): Promise<void> {
  // Bind an OS-assigned free port unless one was pinned explicitly via env.
  if (!process.env.PORT) setPort(await getFreePort())
  logStartup(`starting next server on ${HOST}:${port}`)

  // electron-builder copies `apps/web/.next/standalone` to resources/web, which
  // (for a monorepo) preserves the workspace path: web/apps/web/server.js.
  process.env.PORT = String(port)
  process.env.HOSTNAME = HOST

  // Offline desktop: run the embedded PGlite database. Persist it under the
  // per-user data dir, point at the packaged migrations, and give env validation
  // a non-empty DATABASE_URL even though the embedded driver never connects to
  // it. The workspace resolver applies migrations at request time.
  //
  // ⚠️ DATA SAFETY: the database lives here, in `app.getPath('userData')/pglite`
  // = %APPDATA%\<productName>\pglite — SEPARATE from the installed program files,
  // so it survives updates, reinstalls, and uninstalls (schema changes are
  // applied by the idempotent migrator on launch). This path is derived from the
  // app name, i.e. `productName` in electron-builder.yml / package.json. DO NOT
  // change `productName` (or `appId`) in a released app: it would move this path
  // and orphan every existing user's data. Keep them stable across versions.
  process.env.DATABASE_DRIVER ??= 'embedded'
  process.env.PGLITE_DATA_DIR ??= join(app.getPath('userData'), 'pglite')
  process.env.PGLITE_MIGRATIONS_DIR ??= join(process.resourcesPath, 'migrations')
  process.env.DATABASE_URL ??= 'postgres://embedded'

  // If a reset was requested last session, move the corrupt data dir aside NOW,
  // before the server (and PGlite) load. A fresh cluster then bootstraps below.
  performPendingDbReset(process.env.PGLITE_DATA_DIR)

  const serverEntry = join(process.resourcesPath, 'web', 'apps', 'web', 'server.js')
  await import(pathToFileURL(serverEntry).href)
  await waitForPort(port, HOST, 30_000)
  logStartup(`next server ready on ${HOST}:${port}`)
}
