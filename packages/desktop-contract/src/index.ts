/**
 * The single source of truth for the Electron IPC surface shared between the
 * desktop shell (apps/desktop — main + preload) and the web UI (apps/web) that
 * runs inside it. Channel names, payload/return types, the exposed bridge shape,
 * and the secret-vault allowlist all live here so the two sides can never drift
 * out of sync: the compiler enforces the contract instead of a "must match"
 * comment.
 *
 * MUST stay zero-dependency and free of any `electron` import so BOTH the
 * esbuild-bundled preload/main AND the Next-bundled web app can consume it. It is
 * only strings + types — nothing here touches a runtime API.
 */

// ── IPC channels ─────────────────────────────────────────────────────────────
// The one place channel names are defined. `ipcMain.handle` (main) and
// `ipcRenderer.invoke` (preload) both reference these, so a rename can't
// half-apply.
export const IPC = {
  /** Fully restart the desktop app — recovers a wedged in-process server/DB. */
  appRelaunch: 'app:relaunch',
  /** Open the folder containing the desktop log file in the OS file manager. */
  appOpenLogs: 'app:open-logs',
  /** Reset a corrupt embedded database: back up the bad dir and relaunch fresh. */
  dbReset: 'db:reset',
  /** Write (encrypt + persist) a secret in the OS-keychain-backed vault. */
  secretSet: 'secret:set',
  /** Remove a secret from the vault. */
  secretDelete: 'secret:delete',
  /** Whether a secret is present (never returns the value). */
  secretHas: 'secret:has',
  /** Whether the OS actually provides real encryption for the vault. */
  secretAvailable: 'secret:available',
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]

// ── Secret vault ─────────────────────────────────────────────────────────────
// The allowlist of secret names the renderer may write through the bridge. Adding
// a new keychain secret is a one-line change here that both sides pick up.
export const SECRET_NAMES = ['ANTHROPIC_API_KEY', 'CLAUDE_CODE_OAUTH_TOKEN'] as const
export type SecretName = (typeof SECRET_NAMES)[number]

/** Anthropic API key (AI features). */
export const DESKTOP_AI_KEY: SecretName = 'ANTHROPIC_API_KEY'
/** Claude Code OAuth token (alternative AI auth). */
export const DESKTOP_CLAUDE_TOKEN: SecretName = 'CLAUDE_CODE_OAUTH_TOKEN'

/** Runtime guard: is `name` one of the allowlisted vault secrets? */
export function isSecretName(name: unknown): name is SecretName {
  return typeof name === 'string' && (SECRET_NAMES as readonly string[]).includes(name)
}

// ── Bridge payload / result types ────────────────────────────────────────────
export interface SecretSetResult {
  ok: boolean
  error?: string
}
export interface SecretDeleteResult {
  ok: boolean
}

/**
 * OS-keychain-backed secret storage exposed by the desktop shell. The renderer
 * can write, remove and check secrets — but never read them back (decrypted
 * values live only in the main process).
 */
export interface DesktopSecrets {
  set(name: SecretName, value: string): Promise<SecretSetResult>
  remove(name: SecretName): Promise<SecretDeleteResult>
  has(name: SecretName): Promise<boolean>
  available(): Promise<boolean>
}

/** Electron/Chromium/Node versions the shell reports to the UI. */
export interface DesktopVersions {
  electron: string
  chrome: string
  node: string
}

/**
 * The object the preload bridge exposes on `window.desktop`, and the exact shape
 * the web UI consumes. Present only when the UI runs inside the desktop shell;
 * undefined in a plain browser (see `getDesktopBridge` in the web app).
 */
export interface DesktopBridge {
  isElectron?: boolean
  platform?: string
  versions?: DesktopVersions
  /** Fully restart the desktop app — recovers a wedged in-process server/DB. */
  relaunch?: () => Promise<void> | void
  /** Open the folder containing the desktop log file in the OS file manager. */
  openLogs?: () => Promise<void> | void
  /** Reset a corrupt embedded database: back up the bad dir and relaunch fresh. */
  resetDatabase?: () => Promise<void> | void
  /** Secure secret vault; present only in desktop builds that expose it. */
  secrets?: DesktopSecrets
}
