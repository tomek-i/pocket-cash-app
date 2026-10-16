import { describe, expect, it } from 'vitest'
import { rebalance } from './allocation'
import { FULL_SHARE, isBudgetBucketType } from './buckets'
import { BUDGET_PRESETS, getPreset, matchPreset, presetShares } from './presets'

describe('BUDGET_PRESETS', () => {
  it.each(BUDGET_PRESETS.map((p) => [p.name, p] as const))('%s adds up to 100%%', (_, preset) => {
    const sum = presetShares(preset).reduce((total, s) => total + s.share, 0)
    expect(sum).toBe(FULL_SHARE)
  })

  it('only uses known bucket types', () => {
    for (const preset of BUDGET_PRESETS) {
      for (const type of Object.keys(preset.shares)) expect(isBudgetBucketType(type)).toBe(true)
    }
  })

  it('lists preset shares in bucket order', () => {
    const debt = getPreset('debt')
    expect(debt && presetShares(debt).map((s) => s.type)).toEqual([
      'essentials',
      'lifestyle',
      'savings',
      'debt',
    ])
  })
})

describe('matchPreset', () => {
  const balanced = getPreset('balanced')
  const shares = balanced ? presetShares(balanced) : []

  it('recognises a preset exactly', () => {
    expect(matchPreset(shares)).toBe('balanced')
  })

  it('does not care about order', () => {
    expect(matchPreset([...shares].reverse())).toBe('balanced')
  })

  it('turns into custom after any edit', () => {
    expect(matchPreset(rebalance(shares, 'essentials', 5100))).toBe('custom')
  })

  it('turns into custom when a bucket is added', () => {
    expect(matchPreset([...shares, { type: 'debt', share: 0 }])).toBe('custom')
  })

  it('treats an empty plan as custom', () => {
    expect(matchPreset([])).toBe('custom')
  })
})
