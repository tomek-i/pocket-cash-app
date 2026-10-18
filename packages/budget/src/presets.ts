import { type BucketShare, type BudgetBucketType, sortShares } from './buckets'

/**
 * Ready-made splits, named for what they are good for rather than after the
 * framework they come from. `basedOn` is a sentence crediting the source.
 */
export interface BudgetPreset {
  id: BudgetPresetId
  name: string
  description: string
  basedOn: string
  shares: Partial<Record<BudgetBucketType, number>>
}

export const BUDGET_PRESET_IDS = ['balanced', 'wealth', 'debt', 'savings'] as const

export type BudgetPresetId = (typeof BUDGET_PRESET_IDS)[number]

export const BUDGET_PRESETS: readonly BudgetPreset[] = [
  {
    id: 'balanced',
    name: 'Balanced',
    description: 'A sensible all-rounder.',
    basedOn: 'Based on the 50/30/20 rule and "pay yourself first" (80/20).',
    shares: { essentials: 5000, lifestyle: 3000, savings: 2000 },
  },
  {
    id: 'wealth',
    name: 'Wealth-focused',
    description: 'Invest on purpose every month.',
    basedOn: 'Based on the Conscious Spending Plan and the 70/20/10 budget.',
    shares: { essentials: 5500, lifestyle: 2500, savings: 1000, investing: 1000 },
  },
  {
    id: 'debt',
    name: 'Debt-focused',
    description: 'Put extra towards the mortgage or other debt.',
    basedOn: 'Based on the Barefoot Investor buckets.',
    shares: { essentials: 6000, lifestyle: 1000, savings: 1000, debt: 2000 },
  },
  {
    id: 'savings',
    name: 'Savings-focused',
    description: 'Turn net negative months around and build a buffer.',
    basedOn: 'Our own split, not taken from a framework.',
    shares: { essentials: 5000, lifestyle: 1500, savings: 2500, investing: 1000 },
  },
]

export function getPreset(id: string): BudgetPreset | undefined {
  return BUDGET_PRESETS.find((preset) => preset.id === id)
}

/** A preset's shares as a list, in bucket order. */
export function presetShares(preset: BudgetPreset): BucketShare[] {
  return sortShares(
    Object.entries(preset.shares).map(([type, share]) => ({
      type: type as BudgetBucketType,
      share: share ?? 0,
    })),
  )
}

/**
 * The preset these shares are exactly, or `custom`. Derived rather than stored,
 * so any edit turns a preset into Custom and dialling it back restores the name.
 */
export function matchPreset(shares: readonly BucketShare[]): BudgetPresetId | 'custom' {
  for (const preset of BUDGET_PRESETS) {
    const expected = presetShares(preset)
    if (expected.length !== shares.length) continue
    const matches = expected.every(({ type, share }) =>
      shares.some((s) => s.type === type && s.share === share),
    )
    if (matches) return preset.id
  }
  return 'custom'
}
