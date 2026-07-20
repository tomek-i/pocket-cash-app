import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { isSecretName } from '@repo/desktop-contract'
import { app, safeStorage } from 'electron'

/**
 * Encrypted secret vault for the desktop app. Secrets are encrypted with the OS
 * credential store via Electron `safeStorage` (Keychain on macOS, DPAPI on
 * Windows, libsecret/kwallet on Linux) and persisted as ciphertext under the
 * per-user data dir. Nothing sensitive is written in plaintext, and the renderer
 * can write/check secrets but never read them back.
 *
 * The decrypted values are pushed into `process.env` so the in-process Next
 * server (which shares this process in the packaged build) can consume them the
 * same way a managed web deploy would — via an environment variable.
 */

// The allowlist of writable secret names lives in @repo/desktop-contract
// (SECRET_NAMES / isSecretName) so the renderer, preload and this vault agree.

type Vault = Record<string, string> // name -> base64 ciphertext

function vaultPath(): string {
  return join(app.getPath('userData'), 'secrets.json')
}

function readVault(): Vault {
  const path = vaultPath()
  if (!existsSync(path)) return {}
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as Vault
  } catch {
    return {}
  }
}

function writeVault(vault: Vault): void {
  const path = vaultPath()
  mkdirSync(dirname(path), { recursive: true })
  // mode 0o600 (owner-only) on POSIX; ignored but harmless on Windows.
  writeFileSync(path, JSON.stringify(vault), { encoding: 'utf8', mode: 0o600 })
}

/** Whether the OS actually provides real encryption (false ⇒ don't store secrets). */
export function isSecretStorageAvailable(): boolean {
  return safeStorage.isEncryptionAvailable()
}

export function hasSecret(name: string): boolean {
  return Boolean(readVault()[name])
}

/** Decrypt a stored secret. Internal only — never exposed to the renderer. */
function getSecret(name: string): string | null {
  const enc = readVault()[name]
  if (!enc || !safeStorage.isEncryptionAvailable()) return null
  try {
    return safeStorage.decryptString(Buffer.from(enc, 'base64'))
  } catch {
    return null
  }
}

export function setSecret(name: string, value: string): void {
  if (!isSecretName(name)) throw new Error(`Secret not allowed: ${name}`)
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('OS secure storage is unavailable on this system')
  }
  const vault = readVault()
  vault[name] = safeStorage.encryptString(value).toString('base64')
  writeVault(vault)
  process.env[name] = value // live update for the in-process Next server
}

export function deleteSecret(name: string): void {
  const vault = readVault()
  if (name in vault) {
    delete vault[name]
    writeVault(vault)
  }
  delete process.env[name]
}

/**
 * Decrypt every stored secret into `process.env` so the in-process server can
 * read it. Call once before booting the Next server. Never overwrites a value
 * already present in the environment (an explicit env var wins).
 */
export function loadSecretsIntoEnv(): void {
  const vault = readVault()
  for (const name of Object.keys(vault)) {
    if (process.env[name]) continue
    const value = getSecret(name)
    if (value) process.env[name] = value
  }
}
