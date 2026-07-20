'use server'

import { type CategoryOption, isAiEnabled, suggestCategories } from '@repo/ai'
import {
  type Category,
  categories,
  db,
  inArray,
  isNotNull,
  isNull,
  transactions,
} from '@repo/database'
import { revalidatePath } from 'next/cache'
import { getAiConfig } from '../settings/actions'

// Mirror of the SQL REF_CODE normalisation used by findSimilarTransactions: drop
// a trailing 8+ char alphanumeric token containing a digit (bank reference tail),
// then lowercase + collapse whitespace so the same merchant groups together.
const REF_CODE = /\s+(?=[a-z0-9]*[0-9])[a-z0-9]{8,}$/i
function normalizeDescription(description: string): string {
  return description.replace(REF_CODE, '').replace(/\s+/g, ' ').trim().toLowerCase()
}

/** How many distinct merchant groups we ever send to the LLM in one run. */
const AI_GROUP_CAP = 200
/** Groups per generateObject call (keeps each prompt small and cheap). */
const AI_BATCH_SIZE = 40

export type SuggestionSource = 'rule' | 'ai' | 'none'

export interface CategorizeGroup {
  key: string
  sampleDescription: string
  transactionIds: string[]
  count: number
  suggestedCategoryId: string | null
  suggestedDisplayName: string | null
  confidence: number
  source: SuggestionSource
}

export interface CategorizeResult {
  groups: CategorizeGroup[]
  categories: Pick<Category, 'id' | 'name' | 'color' | 'icon'>[]
  totalUncategorised: number
  /** Whether the LLM was actually invoked (mode on + configured + requested). */
  aiUsed: boolean
  aiError?: string
  /** True when more groups existed than we sent to the LLM (see AI_GROUP_CAP). */
  truncated: boolean
}

interface Rule {
  categoryId: string
  confidence: number
}

/**
 * Learn a merchant→category map from the workspace's already-categorised
 * transactions. For each normalised description key, take the dominant category
 * and score it by how much of that key's history agrees.
 */
async function buildRules(): Promise<Map<string, Rule>> {
  const rows = await db
    .select({ description: transactions.description, categoryId: transactions.categoryId })
    .from(transactions)
    .where(isNotNull(transactions.categoryId))

  // key -> categoryId -> count
  const tally = new Map<string, Map<string, number>>()
  for (const r of rows) {
    if (!r.categoryId) continue
    const key = normalizeDescription(r.description)
    if (!key) continue
    const byCat = tally.get(key) ?? new Map<string, number>()
    byCat.set(r.categoryId, (byCat.get(r.categoryId) ?? 0) + 1)
    tally.set(key, byCat)
  }

  const rules = new Map<string, Rule>()
  for (const [key, byCat] of tally) {
    let bestId = ''
    let bestCount = 0
    let total = 0
    for (const [catId, count] of byCat) {
      total += count
      if (count > bestCount) {
        bestCount = count
        bestId = catId
      }
    }
    if (!bestId) continue
    const share = bestCount / total
    // A single prior example is a weak signal; two+ agreeing is strong.
    const confidence = bestCount >= 2 ? share : share * 0.7
    if (confidence >= 0.5) rules.set(key, { categoryId: bestId, confidence })
  }
  return rules
}

/** A few of the user's own categorised transactions, as LLM few-shot examples. */
async function fewShotExamples(
  categoryNames: Map<string, string>,
): Promise<{ description: string; categoryName: string }[]> {
  const rows = await db
    .select({ description: transactions.description, categoryId: transactions.categoryId })
    .from(transactions)
    .where(isNotNull(transactions.categoryId))
    .limit(400)

  const seen = new Set<string>()
  const out: { description: string; categoryName: string }[] = []
  for (const r of rows) {
    if (!r.categoryId) continue
    const name = categoryNames.get(r.categoryId)
    if (!name || seen.has(name)) continue // one example per category, for breadth
    seen.add(name)
    out.push({ description: r.description.slice(0, 80), categoryName: name })
    if (out.length >= 12) break
  }
  return out
}

/**
 * Propose categories (and clean display names) for every uncategorised
 * transaction. Cheap history-learned rules run first and offline; anything left
 * over is sent to the LLM in small batches when AI is enabled and requested.
 * Nothing is written — the caller reviews and applies via `applyCategorizations`.
 */
export async function suggestCategorizations(opts?: {
  useAi?: boolean
}): Promise<CategorizeResult> {
  const catRows = await db.query.categories.findMany({
    columns: { id: true, name: true, color: true, icon: true },
    orderBy: (c, { asc }) => [asc(c.name)],
  })
  const categoryNames = new Map(catRows.map((c) => [c.id, c.name]))

  const uncategorised = await db
    .select({ id: transactions.id, description: transactions.description })
    .from(transactions)
    .where(isNull(transactions.categoryId))

  // Group the uncategorised rows by normalised merchant key.
  const groups = new Map<string, { sample: string; ids: string[] }>()
  for (const r of uncategorised) {
    const key = normalizeDescription(r.description) || r.description.toLowerCase()
    const g = groups.get(key) ?? { sample: r.description, ids: [] }
    g.ids.push(r.id)
    groups.set(key, g)
  }

  const rules = await buildRules()

  const result: CategorizeGroup[] = []
  const aiTail: { key: string; sampleDescription: string }[] = []
  for (const [key, g] of groups) {
    const rule = rules.get(key)
    if (rule) {
      result.push({
        key,
        sampleDescription: g.sample,
        transactionIds: g.ids,
        count: g.ids.length,
        suggestedCategoryId: rule.categoryId,
        suggestedDisplayName: null,
        confidence: rule.confidence,
        source: 'rule',
      })
    } else {
      result.push({
        key,
        sampleDescription: g.sample,
        transactionIds: g.ids,
        count: g.ids.length,
        suggestedCategoryId: null,
        suggestedDisplayName: null,
        confidence: 0,
        source: 'none',
      })
    }
  }

  // Decide whether to spend tokens on the tail (groups without a rule).
  const config = await getAiConfig()
  const wantAi = opts?.useAi !== false
  let aiUsed = false
  let aiError: string | undefined
  let truncated = false

  if (wantAi && isAiEnabled(config)) {
    const tailKeys = result.filter((g) => g.source === 'none').map((g) => g.key)
    truncated = tailKeys.length > AI_GROUP_CAP
    const keys = tailKeys.slice(0, AI_GROUP_CAP)
    if (keys.length > 0) {
      const byKey = new Map(result.map((g) => [g.key, g]))
      for (const k of keys) {
        const g = byKey.get(k)
        if (g) aiTail.push({ key: k, sampleDescription: g.sampleDescription })
      }
      const options: CategoryOption[] = catRows.map((c) => ({ id: c.id, name: c.name }))
      const examples = await fewShotExamples(categoryNames)
      try {
        for (let i = 0; i < aiTail.length; i += AI_BATCH_SIZE) {
          const batch = aiTail.slice(i, i + AI_BATCH_SIZE)
          const suggestions = await suggestCategories({
            config,
            categories: options,
            examples,
            items: batch,
          })
          for (const s of suggestions) {
            const g = byKey.get(s.key)
            if (!g) continue
            g.suggestedCategoryId = s.categoryId
            g.suggestedDisplayName = s.displayName
            g.confidence = s.confidence
            g.source = 'ai'
          }
        }
        aiUsed = true
      } catch (error) {
        aiError = error instanceof Error ? error.message : 'AI suggestion failed'
      }
    }
  }

  // Show the most confident, largest groups first.
  result.sort((a, b) => b.confidence - a.confidence || b.count - a.count)

  return {
    groups: result,
    categories: catRows,
    totalUncategorised: uncategorised.length,
    aiUsed,
    aiError,
    truncated,
  }
}

export type ApplyResult = { ok: true; updated: number } | { error: string }

/**
 * Apply reviewed categorisations. Each entry sets a category and/or a clean
 * display name on its group of transactions. Category ids are validated against
 * the workspace; unknown ids are skipped rather than failing the whole batch.
 */
export async function applyCategorizations(input: {
  entries: { ids: string[]; categoryId?: string | null; displayName?: string | null }[]
}): Promise<ApplyResult> {
  const entries = input.entries.filter((e) => e.ids.length > 0)
  if (entries.length === 0) return { error: 'Nothing selected' }

  const validCats = new Set(
    (await db.select({ id: categories.id }).from(categories)).map((c) => c.id),
  )

  const updated = await db.transaction(async (tx) => {
    let count = 0
    for (const entry of entries) {
      const set: Partial<{
        categoryId: string | null
        displayName: string | null
        updatedAt: Date
      }> = {}
      if (entry.categoryId !== undefined) {
        if (entry.categoryId && !validCats.has(entry.categoryId)) continue
        set.categoryId = entry.categoryId
      }
      if (entry.displayName !== undefined) {
        set.displayName = entry.displayName?.trim() || null
      }
      if (Object.keys(set).length === 0) continue
      set.updatedAt = new Date()

      // Chunk ids to stay under the bind-parameter limit on large groups.
      for (let i = 0; i < entry.ids.length; i += 1000) {
        const chunk = entry.ids.slice(i, i + 1000)
        const res = await tx
          .update(transactions)
          .set(set)
          .where(inArray(transactions.id, chunk))
          .returning({ id: transactions.id })
        count += res.length
      }
    }
    return count
  })

  revalidatePath('/app/transactions')
  revalidatePath('/app/categorize')
  revalidatePath('/app')
  return { ok: true, updated }
}
