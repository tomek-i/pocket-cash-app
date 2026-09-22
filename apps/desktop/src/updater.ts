import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { UpdateCheckResult, UpdateStatus } from '@repo/desktop-contract'
import { app, dialog, type MessageBoxOptions, shell } from 'electron'
import { autoUpdater } from 'electron-updater'
import { logStartup } from './logging'
import { readPreferences, writePreferences } from './preferences'
import { getMainWindow } from './windows/app-window'

// Update checks against the project's GitHub Releases. This is the ONE network
// call the app makes on its own, so it is a setting (on by default) and it only
// ever reads release metadata: no user data, no identifiers. electron-updater
// finds the feed via the app-update.yml electron-builder writes from the
// `publish` block in electron-builder.yml, and each release carries the
// latest*.yml files it reads (see the release workflow).

// Where a user without a self-installing build goes to download. Must match the
// `publish` owner/repo in electron-builder.yml.
const RELEASES_URL = 'https://github.com/tomek-i/pocket-cash-app/releases'

// Leave startup alone: check once the window has had time to paint and settle.
const LAUNCH_CHECK_DELAY_MS = 10_000

let checking: Promise<UpdateCheckResult> | null = null
let prompting = false
let downloadedVersion: string | null = null

/** Dev and unpackaged builds have no app-update.yml and nothing to update. */
function isSupported(): boolean {
  return app.isPackaged
}

/**
 * Only some installs can replace themselves. The Windows NSIS install (it leaves
 * an uninstaller next to the exe) and a Linux AppImage can. The portable exe and
 * the zip have no installer to run, and macOS refuses to apply an update to an
 * app that is only ad-hoc signed (no Apple Developer ID). Those get a link to the
 * release page instead.
 */
function canInstall(): boolean {
  if (!isSupported()) return false
  if (process.platform === 'win32') {
    if (process.env.PORTABLE_EXECUTABLE_DIR) return false
    const uninstaller = join(dirname(process.execPath), `Uninstall ${app.getName()}.exe`)
    return existsSync(uninstaller)
  }
  if (process.platform === 'linux') return Boolean(process.env.APPIMAGE)
  return false
}

export function getUpdateStatus(): UpdateStatus {
  return {
    autoCheck: readPreferences().autoUpdateCheck,
    currentVersion: app.getVersion(),
    supported: isSupported(),
    canInstall: canInstall(),
  }
}

export function setAutoCheck(enabled: boolean): UpdateStatus {
  writePreferences({ autoUpdateCheck: enabled })
  logStartup(`update check on launch ${enabled ? 'enabled' : 'disabled'}`)
  return getUpdateStatus()
}

/** Call once the main window exists. Schedules the launch check if it is enabled. */
export function initAutoUpdates(): void {
  if (!isSupported()) return

  // We ask before downloading anything, and never download on a build that
  // can't install. A downloaded update the user postponed installs on quit.
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.logger = {
    info: (m) => logStartup(`[updater] ${String(m)}`),
    warn: (m) => logStartup(`[updater] WARN ${String(m)}`),
    error: (m) => logStartup(`[updater] ERROR ${String(m)}`),
  }

  if (!readPreferences().autoUpdateCheck) {
    logStartup('update check on launch is off')
    return
  }
  setTimeout(() => {
    // Background check: failures (offline, GitHub down) are logged, never shown.
    void checkForUpdates()
  }, LAUNCH_CHECK_DELAY_MS)
}

/**
 * Check for a newer release. When one is found, show the install (or download
 * page) prompt without waiting for the user to answer it, so the caller gets the
 * result straight away.
 */
export function checkForUpdates(): Promise<UpdateCheckResult> {
  if (!isSupported()) return Promise.resolve({ status: 'unsupported' })
  checking ??= runCheck().finally(() => {
    checking = null
  })
  return checking
}

async function runCheck(): Promise<UpdateCheckResult> {
  try {
    const result = await autoUpdater.checkForUpdates()
    if (!result?.isUpdateAvailable) return { status: 'up-to-date' }
    const { version } = result.updateInfo
    void promptForUpdate(version)
    return { status: 'available', version }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logStartup(`[updater] check failed: ${message}`)
    return { status: 'error', error: message }
  }
}

async function showMessage(options: MessageBoxOptions): Promise<number> {
  const parent = getMainWindow()
  const { response } = parent
    ? await dialog.showMessageBox(parent, options)
    : await dialog.showMessageBox(options)
  return response
}

async function promptForUpdate(version: string): Promise<void> {
  // One prompt at a time: a manual check while the launch prompt is open, or a
  // second check before the user answers, must not stack dialogs.
  if (prompting) return
  prompting = true
  try {
    if (downloadedVersion === version) {
      await promptToRestart(version)
    } else if (canInstall()) {
      await promptToInstall(version)
    } else {
      await promptToDownload(version)
    }
  } finally {
    prompting = false
  }
}

async function promptToInstall(version: string): Promise<void> {
  const choice = await showMessage({
    type: 'info',
    title: 'Update available',
    message: `Pocket Cash ${version} is available`,
    detail: `You have ${app.getVersion()}. Download and install it now? Your data stays where it is.`,
    buttons: ['Download and install', 'Later'],
    defaultId: 0,
    cancelId: 1,
  })
  if (choice !== 0) return

  try {
    await autoUpdater.downloadUpdate()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logStartup(`[updater] download failed: ${message}`)
    const retry = await showMessage({
      type: 'error',
      title: 'Update failed',
      message: 'The update could not be downloaded',
      detail: `${message}\n\nYou can download it from the release page instead.`,
      buttons: ['Open download page', 'Close'],
      defaultId: 0,
      cancelId: 1,
    })
    if (retry === 0) await shell.openExternal(releaseUrl(version))
    return
  }

  downloadedVersion = version
  await promptToRestart(version)
}

async function promptToRestart(version: string): Promise<void> {
  const choice = await showMessage({
    type: 'info',
    title: 'Update ready',
    message: `Pocket Cash ${version} is ready to install`,
    detail: 'Restart now to finish. If you choose Later, it installs the next time you quit.',
    buttons: ['Restart now', 'Later'],
    defaultId: 0,
    cancelId: 1,
  })
  if (choice !== 0) return
  logStartup(`[updater] restarting to install ${version}`)
  // Silent install (the NSIS installer is one-click anyway), then relaunch.
  setImmediate(() => autoUpdater.quitAndInstall(true, true))
}

async function promptToDownload(version: string): Promise<void> {
  const how =
    process.platform === 'darwin'
      ? 'Download the new version and replace the app in your Applications folder.'
      : 'Download the new version from the release page.'
  const choice = await showMessage({
    type: 'info',
    title: 'Update available',
    message: `Pocket Cash ${version} is available`,
    detail: `You have ${app.getVersion()}. ${how} Your data stays where it is.`,
    buttons: ['Open download page', 'Later'],
    defaultId: 0,
    cancelId: 1,
  })
  if (choice === 0) await shell.openExternal(releaseUrl(version))
}

function releaseUrl(version: string): string {
  return `${RELEASES_URL}/tag/v${version}`
}
