import { spawn } from 'node:child_process'
import { createServer } from 'node:net'

/**
 * Launch the desktop app for development: `next dev` and Electron, agreed on a
 * port.
 *
 * The port used to be hard-coded as 3000 in three separate places, and `next dev`
 * silently moves to 3001 when 3000 is taken. So with anything already on 3000,
 * including a stale dev server of this same app, Electron would wait on 3000 and
 * then load whatever was sitting there. That looks like the app half working,
 * which is a worse failure than not starting at all.
 *
 * The port is resolved once here and passed to all three. 3000 is kept when it is
 * free, because the familiar URL is worth having, and the OS picks an unused one
 * when it is not. This mirrors what the packaged app already does in
 * `src/server.ts`, where the port is always OS-assigned.
 */

const HOST = '127.0.0.1'
const PREFERRED_PORT = 3000

/** True when nothing is listening on this port. */
function isFree(port) {
  return new Promise((resolve) => {
    const probe = createServer()
    probe.once('error', () => resolve(false))
    probe.once('listening', () => probe.close(() => resolve(true)))
    probe.listen(port, HOST)
  })
}

/** An unused port, chosen by the OS. */
function freePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer()
    probe.once('error', reject)
    probe.listen(0, HOST, () => {
      const address = probe.address()
      const port = typeof address === 'object' && address ? address.port : 0
      probe.close(() => resolve(port))
    })
  })
}

async function resolvePort() {
  // An explicit PORT wins, the same rule the packaged app follows.
  if (process.env.PORT) return Number(process.env.PORT)
  if (await isFree(PREFERRED_PORT)) return PREFERRED_PORT
  return freePort()
}

const port = await resolvePort()
if (port !== PREFERRED_PORT) {
  console.log(`[dev] port ${PREFERRED_PORT} is in use, using ${port} instead`)
}

const web = [
  'cross-env',
  'DATABASE_DRIVER=embedded',
  'PGLITE_DATA_DIR=.pglite',
  'PGLITE_MIGRATIONS_DIR=../../packages/database/drizzle/migrations',
  `PORT=${port}`,
  'pnpm --filter web dev',
].join(' ')

// `wait-on` guards the same port the web command was told to use, so a mismatch
// times out with a clear message instead of loading the wrong thing.
const electron = [
  'node scripts/prepare-icon.mjs',
  'node esbuild.mjs',
  `wait-on tcp:${HOST}:${port}`,
  `cross-env NODE_ENV=development PORT=${port} electron dist/main.cjs`,
].join(' && ')

// Run through `pnpm exec` so the binary resolves from the workspace rather than
// from whatever PATH happens to carry. Quoted rather than passed as an args
// array: each of these is one argument to concurrently, which runs it through
// its own shell.
const command = [
  'pnpm exec concurrently',
  '-k',
  '-n web,electron',
  '-c blue,magenta',
  JSON.stringify(web),
  JSON.stringify(electron),
].join(' ')

const child = spawn(command, { stdio: 'inherit', shell: true })
child.on('exit', (code, signal) => {
  process.exit(signal ? 1 : (code ?? 0))
})
