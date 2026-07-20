'use client'

import type { AiConfig } from '@repo/ai'
import {
  Button,
  cn,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui'
import { useActionState, useEffect, useState, useTransition } from 'react'
import type { ActionState } from '@/lib/action-state'
import {
  DESKTOP_AI_KEY,
  DESKTOP_CLAUDE_TOKEN,
  type DesktopSecrets,
  getDesktopBridge,
  type SecretName,
} from '@/lib/desktop'
import { type AiKeyStatus, testAiConnection, updateAiSettings } from '../actions'

// Which form fields carry a secret that must go to the OS keychain (desktop only).
const DESKTOP_SECRET_FIELDS = [
  { field: 'anthropicApiKey', name: DESKTOP_AI_KEY },
  { field: 'claudeOauthToken', name: DESKTOP_CLAUDE_TOKEN },
] as const

export function AiSettings({ config, keyStatus }: { config: AiConfig; keyStatus: AiKeyStatus }) {
  const [state, formAction, actionPending] = useActionState<ActionState, FormData>(
    updateAiSettings,
    null,
  )
  const [mode, setMode] = useState<AiConfig['mode']>(config.mode)
  const [saved, setSaved] = useState(false)
  const [saving, startSaving] = useTransition()
  const [testing, startTest] = useTransition()
  const [testResult, setTestResult] = useState<string | null>(null)
  const [keyError, setKeyError] = useState<string | null>(null)

  // Desktop secret vault (present only in the Electron shell). Secrets are written
  // to the OS keychain via the bridge, never the DB.
  const [secrets, setSecrets] = useState<DesktopSecrets | null>(null)
  const [vaultHasKey, setVaultHasKey] = useState(keyStatus.desktop ? false : keyStatus.serverHasKey)
  const [vaultHasToken, setVaultHasToken] = useState(false)
  const [secureAvailable, setSecureAvailable] = useState(true)

  useEffect(() => {
    if (!keyStatus.desktop) return
    const bridge = getDesktopBridge()?.secrets
    if (!bridge) return
    setSecrets(bridge)
    bridge.has(DESKTOP_AI_KEY).then(setVaultHasKey)
    bridge.has(DESKTOP_CLAUDE_TOKEN).then(setVaultHasToken)
    bridge.available().then(setSecureAvailable)
  }, [keyStatus.desktop])

  useEffect(() => {
    if (!state?.ok) return
    setSaved(true)
    const t = setTimeout(() => setSaved(false), 2500)
    return () => clearTimeout(t)
  }, [state])

  const hasKey = keyStatus.desktop ? vaultHasKey : keyStatus.serverHasKey
  const showMigrationNotice = keyStatus.desktop && keyStatus.legacyDbKey && !vaultHasKey

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setKeyError(null)

    if (keyStatus.desktop) {
      startSaving(async () => {
        for (const { field, name } of DESKTOP_SECRET_FIELDS) {
          const typed = String(fd.get(field) ?? '').trim()
          fd.delete(field) // secrets never travel through the server action on desktop
          if (!typed) continue
          if (!secrets) {
            setKeyError('Update the desktop app to store keys securely.')
            return
          }
          const res = await secrets.set(name, typed)
          if (!res.ok) {
            setKeyError(res.error ?? 'Failed to store secret in the keychain.')
            return
          }
          if (name === DESKTOP_AI_KEY) setVaultHasKey(true)
          else setVaultHasToken(true)
        }
        formAction(fd)
      })
      return
    }

    formAction(fd)
  }

  const removeSecret = (name: SecretName, clear: () => void) =>
    startSaving(async () => {
      setKeyError(null)
      if (!secrets) return
      await secrets.remove(name)
      clear()
    })

  const pending = saving || actionPending

  return (
    <form onSubmit={onSubmit} className="grid max-w-lg gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="ai-mode">Provider</Label>
        <Select
          name="mode"
          value={mode}
          onValueChange={(v) => setMode((v as AiConfig['mode']) ?? 'off')}
        >
          <SelectTrigger id="ai-mode">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="off">Off</SelectItem>
            <SelectItem value="anthropic">Claude (cloud · your API key)</SelectItem>
            <SelectItem value="ollama">Ollama (local · offline)</SelectItem>
            {keyStatus.desktop ? (
              <SelectItem value="claude-cli">Claude subscription (local CLI)</SelectItem>
            ) : null}
          </SelectContent>
        </Select>
      </div>

      {/* Fields stay mounted (hidden when inactive) so switching modes doesn't wipe them. */}
      <div className={cn('grid gap-1.5', mode !== 'anthropic' && 'hidden')}>
        <Label htmlFor="anthropicApiKey">Anthropic API key</Label>
        <Input
          id="anthropicApiKey"
          name="anthropicApiKey"
          type="password"
          autoComplete="off"
          placeholder={hasKey ? '•••••••• (leave blank to keep)' : 'sk-ant-…'}
        />
        {keyStatus.desktop ? (
          <p className="text-muted-foreground text-xs">
            Stored in your operating system’s keychain (encrypted at rest), never in the database or
            the browser. Descriptions are sent to Anthropic only when you run an AI action.
          </p>
        ) : (
          <p className="text-muted-foreground text-xs">
            Transaction descriptions are sent to Anthropic when you run an AI action. The key is
            stored in this workspace and never sent back to the browser.
          </p>
        )}
        {keyStatus.desktop && !secureAvailable ? (
          <p className="rounded-md bg-destructive/10 px-2 py-1.5 text-destructive text-xs">
            Your system has no secure credential store available, so the key can’t be encrypted at
            rest. On Linux, install a secret service (e.g. gnome-keyring) and retry.
          </p>
        ) : null}
        {showMigrationNotice ? (
          <p className="rounded-md bg-muted px-2 py-1.5 text-muted-foreground text-xs">
            A key is still stored in the old, unencrypted location. Re-enter it above and save to
            move it into your keychain — the old copy is then removed.
          </p>
        ) : null}
        {keyStatus.desktop && vaultHasKey ? (
          <button
            type="button"
            className="w-fit text-muted-foreground text-xs underline hover:text-foreground"
            onClick={() => removeSecret(DESKTOP_AI_KEY, () => setVaultHasKey(false))}
          >
            Remove stored key
          </button>
        ) : null}
      </div>

      <div className={cn('grid gap-1.5', mode !== 'ollama' && 'hidden')}>
        <Label htmlFor="ollamaBaseUrl">Ollama URL</Label>
        <Input
          id="ollamaBaseUrl"
          name="ollamaBaseUrl"
          defaultValue={config.ollamaBaseUrl ?? 'http://localhost:11434'}
          placeholder="http://localhost:11434"
        />
        <p className="text-muted-foreground text-xs">
          Runs fully offline against your local Ollama — nothing leaves your machine.
        </p>
      </div>

      {/* Claude subscription via the local Claude Code CLI (desktop only). */}
      <div className={cn('grid gap-1.5', mode !== 'claude-cli' && 'hidden')}>
        <Label htmlFor="claudeOauthToken">Claude Code OAuth token (optional)</Label>
        <Input
          id="claudeOauthToken"
          name="claudeOauthToken"
          type="password"
          autoComplete="off"
          placeholder={vaultHasToken ? '•••••••• (leave blank to keep)' : 'sk-ant-oat…'}
        />
        <p className="text-muted-foreground text-xs">
          Uses your Claude Pro/Max plan through the local Claude Code CLI — no API key, no metered
          billing. Run <code className="rounded bg-muted px-1">claude setup-token</code> for a
          1-year token and paste it here (stored in your OS keychain), or leave this blank to use
          your existing <code className="rounded bg-muted px-1">claude login</code> session.
        </p>
        {!secureAvailable ? (
          <p className="rounded-md bg-destructive/10 px-2 py-1.5 text-destructive text-xs">
            No secure credential store is available, so a token can’t be encrypted at rest — rely on
            your <code className="rounded bg-muted px-1">claude login</code> session instead.
          </p>
        ) : null}
        {vaultHasToken ? (
          <button
            type="button"
            className="w-fit text-muted-foreground text-xs underline hover:text-foreground"
            onClick={() => removeSecret(DESKTOP_CLAUDE_TOKEN, () => setVaultHasToken(false))}
          >
            Remove stored token
          </button>
        ) : null}
      </div>

      <div className={cn('grid gap-4 sm:grid-cols-2', mode === 'off' && 'hidden')}>
        <div className="grid gap-1.5">
          <Label htmlFor="fastModel">Fast model</Label>
          <Input
            id="fastModel"
            name="fastModel"
            defaultValue={config.fastModel ?? ''}
            placeholder={
              mode === 'ollama'
                ? 'llama3.1'
                : mode === 'claude-cli'
                  ? 'haiku'
                  : 'claude-haiku-4-5-20251001'
            }
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="smartModel">Smart model</Label>
          <Input
            id="smartModel"
            name="smartModel"
            defaultValue={config.smartModel ?? ''}
            placeholder={
              mode === 'ollama' ? 'llama3.1' : mode === 'claude-cli' ? 'sonnet' : 'claude-sonnet-5'
            }
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save'}
        </Button>
        {mode !== 'off' ? (
          <Button
            type="button"
            variant="outline"
            disabled={testing}
            onClick={() =>
              startTest(async () => {
                setTestResult(null)
                const res = await testAiConnection()
                setTestResult('error' in res ? `✕ ${res.error}` : `✓ ${res.text || 'ready'}`)
              })
            }
          >
            {testing ? 'Testing…' : 'Test connection'}
          </Button>
        ) : null}
        {saved ? <span className="text-success text-sm">Saved</span> : null}
      </div>
      {keyError ? <p className="text-destructive text-xs">{keyError}</p> : null}
      {testResult ? (
        <p className="break-words text-muted-foreground text-xs">{testResult}</p>
      ) : null}
    </form>
  )
}
