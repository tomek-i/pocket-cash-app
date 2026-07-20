import { generatePlainText } from './generate'
import type { AiConfig } from './provider'

/** Round-trip a tiny prompt to verify the provider/key/model actually works. */
export async function pingModel(config: AiConfig): Promise<string> {
  const text = await generatePlainText({
    config,
    tier: 'fast',
    prompt: 'Reply with the single word: ready',
  })
  return text.trim()
}
