import {
  type DesktopBridge,
  IPC,
  type SecretDeleteResult,
  type SecretName,
  type SecretSetResult,
} from '@repo/desktop-contract'
import { contextBridge, ipcRenderer } from 'electron'

// Minimal, safe bridge. Channel names + the exposed shape come from
// @repo/desktop-contract (the single source of truth shared with the web UI and
// the main process), so the renderer and main can never disagree on a key.
// Extend native capabilities here — always through contextBridge, never by
// enabling nodeIntegration.
const bridge: DesktopBridge = {
  isElectron: true,
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
  /**
   * Fully restart the app. In the packaged build the Next server (and embedded
   * database) run inside this process, so relaunching is the clean recovery if
   * they ever wedge — a renderer reload alone can't fix an in-process server.
   */
  relaunch: () => ipcRenderer.invoke(IPC.appRelaunch),
  /**
   * Open the folder containing the log file in the OS file manager. Lets the
   * user find (and share) the diagnostics behind an on-screen error reference.
   */
  openLogs: () => ipcRenderer.invoke(IPC.appOpenLogs),
  /**
   * Reset the embedded database when it's corrupt and won't boot. Moves the bad
   * data directory aside (backed up) and relaunches into a fresh cluster.
   * Destructive — the existing local data is discarded.
   */
  resetDatabase: () => ipcRenderer.invoke(IPC.dbReset),
  /**
   * OS-keychain-backed secret storage. The renderer may write, remove and check
   * secrets, but can NEVER read them back — decrypted values only ever live in
   * the main process (and its in-process Next server). Values are encrypted at
   * rest via Electron safeStorage.
   */
  secrets: {
    set: (name: SecretName, value: string): Promise<SecretSetResult> =>
      ipcRenderer.invoke(IPC.secretSet, name, value),
    remove: (name: SecretName): Promise<SecretDeleteResult> =>
      ipcRenderer.invoke(IPC.secretDelete, name),
    has: (name: SecretName): Promise<boolean> => ipcRenderer.invoke(IPC.secretHas, name),
    available: (): Promise<boolean> => ipcRenderer.invoke(IPC.secretAvailable),
  },
}

contextBridge.exposeInMainWorld('desktop', bridge)
