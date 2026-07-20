import { z } from 'zod'
import { generateStructured } from './generate'
import type { AiConfig } from './provider'

export interface SummariseInput {
  config: AiConfig
  /** A short label for what's being summarised, e.g. "FY2025 (1 Jul 2024 – 30 Jun 2025)". */
  subject: string
  /**
   * Pre-computed, human-readable facts (money already formatted as strings). The
   * model only phrases these — it must never compute or invent figures.
   */
  facts: Record<string, unknown>
}

export interface Summary {
  /** A short paragraph (2–4 sentences). */
  summary: string
  /** A handful of one-line highlights. */
  highlights: string[]
}

const responseSchema = z.object({
  summary: z.string(),
  highlights: z.array(z.string()),
})

const SYSTEM = `You are a concise personal-finance assistant summarising one person's own spending data.
Rules:
- Only use the numbers provided in the facts. NEVER compute, estimate, or invent any figure — quote the pre-formatted amounts exactly as given.
- Write in plain, friendly language, second person ("you spent…"). No preamble, no sign-off.
- "summary" is 2–4 sentences covering the headline: income vs spending, whether they saved, and the biggest driver.
- "highlights" is 3–5 short bullet strings (no leading bullet character) — notable categories, changes vs the prior period, or things worth a look.
- Be neutral and factual. Do not give tax or investment advice.`

/**
 * Turn a compact, pre-computed facts object into a short narrative + highlights.
 * The model phrases the numbers; all arithmetic happens in SQL/JS before this call.
 */
export async function summarise(input: SummariseInput): Promise<Summary> {
  const object = await generateStructured({
    config: input.config,
    tier: 'smart',
    schema: responseSchema,
    system: SYSTEM,
    prompt: `Summarise ${input.subject}. Facts (JSON):\n${JSON.stringify(input.facts, null, 2)}`,
  })
  return {
    summary: object.summary.trim(),
    highlights: object.highlights.map((h) => h.trim()).filter(Boolean),
  }
}
