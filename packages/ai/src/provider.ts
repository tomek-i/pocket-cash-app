import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import type { LanguageModel } from 'ai'

/**
 * Provider-agnostic AI config, stored per workspace. `off` disables all AI.
 * `anthropic` = bring-your-own cloud key; `ollama` = a local model (offline);
 * `claude-cli` = the local Claude Code CLI using your Pro/Max subscription
 * (desktop only — see claude-cli.ts).
 */
export interface AiConfig {
  mode: 'off' | 'anthropic' | 'ollama' | 'claude-cli'
  anthropicApiKey?: string
  /** e.g. http://localhost:11434 (the app appends /v1 for the OpenAI-compatible API). */
  ollamaBaseUrl?: string
  fastModel?: string
  smartModel?: string
}

export type AiTier = 'fast' | 'smart'

export const DEFAULT_MODELS = {
  anthropic: { fast: 'claude-haiku-4-5-20251001', smart: 'claude-sonnet-5' },
  ollama: { fast: 'llama3.1', smart: 'llama3.1' },
  // Claude Code CLI aliases (it resolves these to the current model versions).
  claudeCli: { fast: 'haiku', smart: 'sonnet' },
} as const

/** True when AI is configured enough to actually run. */
export function isAiEnabled(config: AiConfig | undefined | null): config is AiConfig {
  if (!config || config.mode === 'off') return false
  if (config.mode === 'anthropic') return Boolean(config.anthropicApiKey?.trim())
  if (config.mode === 'ollama') return Boolean(config.ollamaBaseUrl?.trim())
  // claude-cli auths via the CLI's own session or a keychain OAuth token, so it's
  // "enabled" whenever selected; a missing CLI/login surfaces at call time.
  if (config.mode === 'claude-cli') return true
  return false
}

function defaultsFor(mode: AiConfig['mode']): { fast: string; smart: string } {
  if (mode === 'ollama') return DEFAULT_MODELS.ollama
  if (mode === 'claude-cli') return DEFAULT_MODELS.claudeCli
  return DEFAULT_MODELS.anthropic
}

/** The model name/alias for a provider + tier, honouring any user override. */
export function modelId(config: AiConfig, tier: AiTier): string {
  const chosen = tier === 'fast' ? config.fastModel : config.smartModel
  return chosen?.trim() || defaultsFor(config.mode)[tier]
}

/**
 * Resolve a Vercel-AI-SDK language model for HTTP providers (anthropic/ollama).
 * The `claude-cli` provider is not an HTTP model — it runs as a subprocess, so
 * callers go through generateStructured/generatePlainText (see generate.ts).
 */
export function getModel(config: AiConfig, tier: AiTier): LanguageModel {
  if (config.mode === 'anthropic') {
    return createAnthropic({ apiKey: config.anthropicApiKey })(modelId(config, tier))
  }
  if (config.mode === 'ollama') {
    const baseURL = `${(config.ollamaBaseUrl ?? 'http://localhost:11434').replace(/\/$/, '')}/v1`
    // Ollama exposes an OpenAI-compatible API; the key is ignored but required.
    return createOpenAICompatible({ name: 'ollama', baseURL, apiKey: 'ollama' })(
      modelId(config, tier),
    )
  }
  throw new Error(`getModel does not support mode "${config.mode}"`)
}
