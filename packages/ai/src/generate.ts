import { generateObject, generateText } from 'ai'
import type { z } from 'zod'
import { runClaudeStructured, runClaudeText } from './claude-cli'
import { type AiConfig, type AiTier, getModel } from './provider'

/**
 * Provider-dispatching generation helpers. HTTP providers (anthropic/ollama) go
 * through the Vercel AI SDK; the `claude-cli` provider runs the local Claude Code
 * CLI as a subprocess. Every feature (categorise/insights/tax/ping) uses these so
 * the dispatch lives in one place and the zod schemas stay identical across modes.
 */

/** Structured output validated against a zod schema, for any configured provider. */
export async function generateStructured<T>(input: {
  config: AiConfig
  tier: AiTier
  schema: z.ZodType<T>
  system: string
  prompt: string
}): Promise<T> {
  if (input.config.mode === 'claude-cli') {
    return runClaudeStructured(input)
  }
  const { object } = await generateObject({
    model: getModel(input.config, input.tier),
    schema: input.schema,
    system: input.system,
    prompt: input.prompt,
  })
  return object
}

/** Plain text completion, for any configured provider. */
export async function generatePlainText(input: {
  config: AiConfig
  tier: AiTier
  system?: string
  prompt: string
}): Promise<string> {
  if (input.config.mode === 'claude-cli') {
    return runClaudeText(input)
  }
  const { text } = await generateText({
    model: getModel(input.config, input.tier),
    system: input.system,
    prompt: input.prompt,
  })
  return text
}
