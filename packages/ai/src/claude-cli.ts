import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import type { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { type AiConfig, type AiTier, modelId } from './provider'

const execFileAsync = promisify(execFile)

/**
 * Run inference through the local Claude Code CLI (`claude -p`) using the user's
 * Pro/Max subscription. Auth resolves in this order (the "token, else CLI login"
 * choice): a `CLAUDE_CODE_OAUTH_TOKEN` in the environment — injected on desktop
 * from the OS keychain vault — otherwise the CLI's own `claude login` session.
 * Desktop only: this spawns a subprocess and can't run in a browser/serverless.
 */

/** Locate the CLI binary: explicit override, then common install locations, then PATH. */
function resolveBinary(): string {
  if (process.env.CLAUDE_CLI_PATH) return process.env.CLAUDE_CLI_PATH
  const home = homedir()
  const candidates =
    process.platform === 'win32'
      ? [join(home, '.local', 'bin', 'claude.exe')]
      : [
          join(home, '.local', 'bin', 'claude'),
          join(home, '.claude', 'local', 'claude'),
          '/usr/local/bin/claude',
          '/opt/homebrew/bin/claude',
        ]
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }
  return process.platform === 'win32' ? 'claude.exe' : 'claude'
}

interface Envelope {
  subtype?: string
  is_error?: boolean
  result?: string
  structured_output?: unknown
}

async function runClaude(args: string[], prompt: string): Promise<Envelope> {
  const bin = resolveBinary()
  try {
    const { stdout } = await execFileAsync(bin, [...args, prompt], {
      // Responses (esp. structured batches) can be large; the default 1MB is tight.
      maxBuffer: 16 * 1024 * 1024,
      windowsHide: true,
      env: process.env,
    })
    const envelope = JSON.parse(stdout) as Envelope
    if (envelope.is_error || envelope.subtype !== 'success') {
      throw new Error(envelope.result || 'Claude CLI returned an error')
    }
    return envelope
  } catch (error) {
    const err = error as NodeJS.ErrnoException
    if (err.code === 'ENOENT') {
      throw new Error(
        'Claude Code CLI not found. Install it and run `claude login`, or set CLAUDE_CLI_PATH.',
      )
    }
    throw error
  }
}

/** One-shot text completion via the CLI. */
export async function runClaudeText(input: {
  config: AiConfig
  tier: AiTier
  system?: string
  prompt: string
}): Promise<string> {
  const args = ['-p', '--model', modelId(input.config, input.tier), '--output-format', 'json']
  if (input.system) args.push('--system-prompt', input.system)
  const envelope = await runClaude(args, input.prompt)
  return (envelope.result ?? '').trim()
}

/** Schema-constrained JSON via the CLI's native `--json-schema` structured output. */
export async function runClaudeStructured<T>(input: {
  config: AiConfig
  tier: AiTier
  schema: z.ZodType<T>
  system: string
  prompt: string
}): Promise<T> {
  // Inline all $refs — Claude's structured output expects a self-contained schema.
  const jsonSchema = zodToJsonSchema(input.schema, { $refStrategy: 'none' })
  const args = [
    '-p',
    '--model',
    modelId(input.config, input.tier),
    '--system-prompt',
    input.system,
    '--output-format',
    'json',
    '--json-schema',
    JSON.stringify(jsonSchema),
  ]
  const envelope = await runClaude(args, input.prompt)
  const raw =
    envelope.structured_output ?? (envelope.result ? JSON.parse(envelope.result) : undefined)
  // Validate against the same zod schema the HTTP providers use.
  return input.schema.parse(raw)
}
