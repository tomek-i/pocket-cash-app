import { app, BrowserWindow, nativeTheme } from 'electron'
import { registerIpcHandlers } from './ipc'
import { logStartup, setupFileLogging } from './logging'
import { loadSecretsIntoEnv } from './secrets'
import { startNextServer } from './server'
import { createWindow, showFatalError } from './windows/app-window'
import { createSplash } from './windows/splash'

// Thin orchestrator. Each concern lives in its own module — logging, the embedded
// Next server, DB-reset recovery, the splash + main windows, the IPC surface, and
// the secret vault. This file just wires the app lifecycle together.
const isDev = process.env.NODE_ENV === 'development'

// Last-resort diagnostics: anything that escapes the try/catch below still lands
// in the log instead of vanishing with the process.
process.on('uncaughtException', (err) => logStartup(`uncaughtException: ${err.stack ?? err}`))
process.on('unhandledRejection', (reason) => logStartup(`unhandledRejection: ${String(reason)}`))

registerIpcHandlers()

app.whenReady().then(async () => {
  // Start file logging first so everything below (and the in-process server) is
  // captured on disk from the very first line.
  setupFileLogging()
  logStartup(`app ready (isDev=${isDev}, resourcesPath=${process.resourcesPath})`)
  // Render the native title bar (and any OS-drawn widgets) dark to match the app.
  nativeTheme.themeSource = 'dark'

  // Paint the splash BEFORE the heavy work below. `startNextServer` synchronously
  // evaluates a large bundle that blocks the main process for a few seconds; if
  // we kicked it off first the splash window would show but stay blank until it
  // finished. Awaiting the painted splash makes startup feel instant.
  await createSplash()

  // Decrypt stored secrets into the environment BEFORE the in-process server
  // boots, so server actions read them from process.env like a web deploy would.
  loadSecretsIntoEnv()

  try {
    if (!isDev) {
      await startNextServer()
    }
    createWindow()
  } catch (error) {
    showFatalError(error)
    return
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
