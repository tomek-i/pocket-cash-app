import type { DesktopBridge } from '@repo/desktop-contract'

// The IPC contract (channel names, secret allowlist, bridge + secret types) is the
// single source of truth shared with the desktop shell — re-exported here so web
// call sites keep importing from '@/lib/desktop'. Only `getDesktopBridge` (which
// touches `window`) is web-specific and lives here.
export {
  DESKTOP_AI_KEY,
  DESKTOP_CLAUDE_TOKEN,
  type DesktopBridge,
  type DesktopSecrets,
  isSecretName,
  SECRET_NAMES,
  type SecretName,
} from '@repo/desktop-contract'

/**
 * Access the Electron preload bridge (apps/desktop/src/preload.ts) when the web
 * UI is running inside the desktop shell. Undefined in a normal browser.
 */
export function getDesktopBridge(): DesktopBridge | undefined {
  if (typeof window === 'undefined') return undefined
  return (window as unknown as { desktop?: DesktopBridge }).desktop
}
