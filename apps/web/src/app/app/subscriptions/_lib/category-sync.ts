import { normalizeText } from './schedule'

/**
 * A subscription or bill is the source of its charges' category: Netflix is
 * Entertainment, the power bill is Bills & Utilities. These pure helpers decide
 * which matched transactions take that category.
 */

export interface CategorySource {
  id: string
  matcher: string | null
  categoryId: string | null
}

export interface CategoryTarget {
  id: string
  merchant: string | null
  description: string
  categoryId: string | null
}

/**
 * The subscription a charge belongs to. The longest matcher wins, so a
 * "netflix premium" subscription beats a plain "netflix" one.
 */
export function matchSource<S extends CategorySource>(text: string, sources: S[]): S | null {
  let best: S | null = null
  let bestLength = 0
  for (const source of sources) {
    const matcher = source.matcher ? normalizeText(source.matcher) : ''
    if (matcher.length > bestLength && text.includes(matcher)) {
      best = source
      bestLength = matcher.length
    }
  }
  return best
}

/**
 * Transaction ids to move, grouped by the category they move to. A transaction
 * with a category only moves when `canReplace` allows it (the generic
 * Subscriptions category, or the one its subscription is moving away from), so
 * a category the user picked by hand is kept.
 */
export function planCategoryUpdates(
  targets: CategoryTarget[],
  sources: CategorySource[],
  canReplace: (categoryId: string, source: CategorySource) => boolean,
): Map<string, string[]> {
  const withCategory = sources.filter((s) => s.matcher && s.categoryId)
  const plan = new Map<string, string[]>()
  if (withCategory.length === 0) return plan

  for (const target of targets) {
    const source = matchSource(
      normalizeText(`${target.merchant ?? ''} ${target.description}`),
      withCategory,
    )
    const categoryId = source?.categoryId
    if (!source || !categoryId || categoryId === target.categoryId) continue
    if (target.categoryId && !canReplace(target.categoryId, source)) continue
    const ids = plan.get(categoryId) ?? []
    ids.push(target.id)
    plan.set(categoryId, ids)
  }
  return plan
}
