import { z } from 'zod'
import { generateStructured } from './generate'
import type { AiConfig } from './provider'

export interface CategoryOption {
  id: string
  name: string
}

/** A distinct merchant/description group to classify (deduped before calling). */
export interface CategorizeItem {
  key: string
  sampleDescription: string
}

export interface CategorySuggestion {
  key: string
  /** A category id from the provided list, or null if none fits. */
  categoryId: string | null
  /** A short, clean human name (e.g. "Raiz Investment"), or null to keep as-is. */
  displayName: string | null
  confidence: number
}

const responseSchema = z.object({
  suggestions: z.array(
    z.object({
      key: z.string(),
      categoryId: z.string().nullable(),
      displayName: z.string().nullable(),
      confidence: z.number().min(0).max(1),
    }),
  ),
})

const SYSTEM = `You categorise personal bank transactions.
Rules:
- Choose the single best categoryId from the provided list, or null if none is a good fit.
- Only use ids that appear in the category list. Never invent ids.
- Suggest a concise, human-friendly displayName (the merchant/payee, e.g. "Raiz Investment", "Woolworths"); strip reference numbers and bank boilerplate. Use null if the description is already clean or you are unsure.
- confidence is 0..1 for how sure you are of the category.
- Return exactly one suggestion per input item, echoing its "key".`

function buildPrompt(input: {
  categories: CategoryOption[]
  examples: { description: string; categoryName: string }[]
  items: CategorizeItem[]
}): string {
  const cats = input.categories.map((c) => `- ${c.id}: ${c.name}`).join('\n')
  const examples = input.examples.length
    ? `\nExamples from this user's own history:\n${input.examples
        .map((e) => `- "${e.description}" → ${e.categoryName}`)
        .join('\n')}\n`
    : ''
  const items = input.items.map((i) => `- key=${i.key} | "${i.sampleDescription}"`).join('\n')
  return `Categories (id: name):\n${cats}\n${examples}\nClassify these items:\n${items}`
}

/**
 * Ask the model to categorise + clean-name a batch of merchant groups. Returns
 * one suggestion per item; category ids are validated against the provided list
 * (unknown ids are coerced to null) so the caller can trust them.
 */
export async function suggestCategories(input: {
  config: AiConfig
  categories: CategoryOption[]
  examples: { description: string; categoryName: string }[]
  items: CategorizeItem[]
}): Promise<CategorySuggestion[]> {
  if (input.items.length === 0) return []

  const object = await generateStructured({
    config: input.config,
    tier: 'fast',
    schema: responseSchema,
    system: SYSTEM,
    prompt: buildPrompt(input),
  })

  const validIds = new Set(input.categories.map((c) => c.id))
  const byKey = new Map(object.suggestions.map((s) => [s.key, s]))
  return input.items.map((item) => {
    const s = byKey.get(item.key)
    const categoryId = s?.categoryId && validIds.has(s.categoryId) ? s.categoryId : null
    return {
      key: item.key,
      categoryId,
      displayName: s?.displayName?.trim() || null,
      confidence: s ? Math.min(1, Math.max(0, s.confidence)) : 0,
    }
  })
}
