import { z } from 'zod'
import { generateStructured } from './generate'
import type { AiConfig } from './provider'

/** One transaction to assess for tax relevance (amount pre-formatted + signed). */
export interface TaxItem {
  key: string
  description: string
  category: string | null
  /** Human-readable signed amount, e.g. "$120.00". */
  amount: string
  direction: 'debit' | 'credit'
}

export interface TaxCandidate {
  key: string
  taxRelevant: boolean
  /** Short reason, e.g. "Possible work-related software". */
  reason: string
  /** Rough bucket: "work expense" | "donation" | "investment" | "income" | "education" | "other" | null. */
  kind: string | null
  confidence: number
}

const responseSchema = z.object({
  candidates: z.array(
    z.object({
      key: z.string(),
      taxRelevant: z.boolean(),
      reason: z.string(),
      kind: z.string().nullable(),
      confidence: z.number().min(0).max(1),
    }),
  ),
})

const SYSTEM = `You help an individual in Australia surface transactions that MIGHT be relevant to their personal income tax return — deductions, work-related expenses, charitable donations, investment income or costs, self-education, etc.
Rules:
- Flag an item only when there is a plausible tax angle. When in doubt, set taxRelevant=false.
- "reason" is a short phrase explaining the angle (e.g. "Possible work-related software", "Deductible donation", "Investment dividend income").
- "kind" is a rough bucket: "work expense", "donation", "investment", "income", "education", or "other" — or null.
- confidence is 0..1.
- Return exactly one entry per input item, echoing its "key".
- You are NOT giving tax advice — you are surfacing items for the person to review with their accountant.`

function buildPrompt(items: TaxItem[]): string {
  const lines = items
    .map(
      (i) =>
        `- key=${i.key} | ${i.direction} ${i.amount} | ${i.category ?? 'Uncategorised'} | "${i.description}"`,
    )
    .join('\n')
  return `Assess these transactions for possible personal-tax relevance:\n${lines}`
}

/**
 * Flag transactions that might matter for an AU personal tax return. Returns one
 * verdict per item (echoing its key); the caller reviews and applies a "tax" tag.
 * Advisory only — never presented as tax advice.
 */
export async function suggestTaxCandidates(input: {
  config: AiConfig
  items: TaxItem[]
}): Promise<TaxCandidate[]> {
  if (input.items.length === 0) return []

  const object = await generateStructured({
    config: input.config,
    tier: 'smart',
    schema: responseSchema,
    system: SYSTEM,
    prompt: buildPrompt(input.items),
  })

  const byKey = new Map(object.candidates.map((c) => [c.key, c]))
  return input.items.map((item) => {
    const c = byKey.get(item.key)
    return {
      key: item.key,
      taxRelevant: Boolean(c?.taxRelevant),
      reason: c?.reason?.trim() || '',
      kind: c?.kind?.trim() || null,
      confidence: c ? Math.min(1, Math.max(0, c.confidence)) : 0,
    }
  })
}
