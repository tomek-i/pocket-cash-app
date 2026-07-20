import { join } from 'node:path'
import { app, BrowserWindow, dialog, shell } from 'electron'
import { logFile, logStartup } from '../logging'
import { getAppUrl, getStartUrl } from '../server'
import { closeSplash } from './splash'

// Startup failed (server never booted, or the window couldn't load the app).
// Surface it instead of leaving an invisible, wedged process behind.
export function showFatalError(error: unknown): void {
  closeSplash()
  const message = error instanceof Error ? error.message : String(error)
  logStartup(`FATAL: ${message}\n${error instanceof Error ? error.stack : ''}`)
  dialog.showErrorBox(
    'Pocket Cash failed to start',
    `${message}\n\nDetails were written to:\n${logFile()}`,
  )
  app.quit()
}

export function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 832,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#0b0c11', // Slate Indigo canvas — avoids white flash on load
    // The app is a dark single-window shell: hide the (white) native menu bar —
    // Alt still reveals it, and copy/paste shortcuts keep working.
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // Hand off from the splash only once the real window has actually rendered.
  win.once('ready-to-show', () => {
    logStartup('main window shown')
    win.show()
    closeSplash()
  })

  // If the app URL fails to load, don't leave the user on the splash forever.
  // (-3 is ERR_ABORTED — a benign artifact of redirects; ignore it.)
  win.webContents.once('did-fail-load', (_e, code, desc) => {
    if (code === -3) return
    showFatalError(new Error(`Could not load the app (${code}): ${desc}`))
  })

  // Keep in-app navigation inside the window; open anything external (a docs or
  // support link the user clicks) in their real browser instead.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(getAppUrl())) {
      shell.openExternal(url)
      return { action: 'deny' }
    }
    return { action: 'allow' }
  })

  const startUrl = getStartUrl()
  logStartup(`loading ${startUrl}`)
  win.loadURL(startUrl)
}
