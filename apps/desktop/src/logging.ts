import { appendFileSync, mkdirSync, openSync, writeSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'

// Append-only log under the per-user data dir. This is the single place to look
// when something goes wrong: it captures the startup lifecycle AND everything the
// in-process Next server prints — including the server-side stack behind the
// "Ref: <digest>" the user sees on the error screen. In a packaged app
// stdout/stderr go nowhere, so without this a runtime error leaves only a digest
// and no way to see what actually failed. Nothing here may throw — diagnostics
// must never break startup.
let logFd: number | null = null

export function logsDir(): string {
  return join(app.getPath('userData'), 'logs')
}

export function logFile(): string {
  return join(logsDir(), 'pocket-cash.log')
}

export function writeLog(text: string): void {
  try {
    if (logFd !== null) {
      writeSync(logFd, text)
    } else {
      // Before setupFileLogging (or if it failed) fall back to a one-shot append.
      mkdirSync(logsDir(), { recursive: true })
      appendFileSync(logFile(), text)
    }
  } catch {
    // ignore — diagnostics must never be fatal
  }
}

export function logStartup(message: string): void {
  writeLog(`[${new Date().toISOString()}] ${message}\n`)
}

// Open the log file and tee process stdout/stderr into it (while still printing
// to the real streams, so dev console output is unchanged). Must run before the
// Next server is imported so its startup + runtime error output is captured too.
export function setupFileLogging(): void {
  try {
    mkdirSync(logsDir(), { recursive: true })
    logFd = openSync(logFile(), 'a')
    writeLog(`\n[${new Date().toISOString()}] ── session start (v${app.getVersion()}) ──\n`)

    for (const stream of [process.stdout, process.stderr]) {
      const original = stream.write.bind(stream)
      stream.write = ((chunk: string | Uint8Array, ...args: unknown[]) => {
        try {
          if (logFd !== null) {
            if (typeof chunk === 'string') writeSync(logFd, chunk)
            else writeSync(logFd, chunk)
          }
        } catch {
          // ignore — never let logging break a write
        }
        // biome-ignore lint/suspicious/noExplicitAny: pass-through of write's overloaded args
        return (original as any)(chunk, ...args)
      }) as typeof stream.write
    }
  } catch {
    // ignore — logging must never break startup
  }
}
