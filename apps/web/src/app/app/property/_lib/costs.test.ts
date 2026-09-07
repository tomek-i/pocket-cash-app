import type { CostType } from '@repo/database'
import type { RateSchedule } from '@repo/property'
import { NSW_TRANSFER_DUTY_2026_27 } from '@repo/property/defaults'
import { describe, expect, it } from 'vitest'
import {
  buildCostContext,
  evaluateCosts,
  type PropertyCostRow,
  summariseUpfrontCosts,
} from './costs'

const context = buildCostContext({
  purchasePrice: 1_000_000_00,
  propertyValue: 1_000_000_00,
  loanAmount: 800_000_00,
  annualRate: 0.06,
})

const schedule: RateSchedule = { ...NSW_TRANSFER_DUTY_2026_27, id: 'schedule-1' }
const scheduleIdByGroup = { 'transfer-tax': 'schedule-1' }

function costType(overrides: Partial<CostType> = {}): CostType {
  return {
    id: 'ct-1',
    key: 'building-inspection',
    name: 'Building Inspection',
    category: 'inspection',
    scope: 'upfront',
    calculationType: 'fixed',
    defaultValue: 600_00,
    percentage: null,
    calculationBase: null,
    formula: null,
    rateScheduleGroup: null,
    defaultFrequency: null,
    currency: null,
    notes: null,
    isSystem: true,
    enabled: true,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as CostType
}

function row(overrides: Partial<PropertyCostRow> = {}): PropertyCostRow {
  return {
    id: 'pc-1',
    costTypeId: 'ct-1',
    enabled: true,
    manualValue: null,
    overrideValue: null,
    actualValue: null,
    sortOrder: 0,
    costType: costType(),
    ...overrides,
  }
}

function evaluate(rows: PropertyCostRow[]) {
  return evaluateCosts({ rows, context, schedules: [schedule], scheduleIdByGroup })
}

describe('buildCostContext', () => {
  it('implies the deposit from the price and the loan', () => {
    expect(context.deposit).toBe(200_000_00)
  })

  it('uses the purchase price as the dutiable value', () => {
    expect(context.dutiableValue).toBe(1_000_000_00)
  })

  it('reports LVR against the property value', () => {
    expect(context.lvr).toBe(0.8)
  })

  it('never reports a negative deposit', () => {
    const over = buildCostContext({
      purchasePrice: 500_000_00,
      propertyValue: 500_000_00,
      loanAmount: 600_000_00,
      annualRate: 0.06,
    })
    expect(over.deposit).toBe(0)
  })
})

describe('evaluateCosts', () => {
  it('uses the cost type default', () => {
    const [entry] = evaluate([row()])
    expect(entry?.result.amount).toBe(600_00)
    expect(entry?.result.automatic).toBe(false)
  })

  it('calculates a bracketed cost from the resolved schedule', () => {
    const [entry] = evaluate([
      row({
        costType: costType({
          key: 'transfer-duty',
          name: 'Transfer Duty',
          category: 'government',
          calculationType: 'bracketed',
          calculationBase: 'dutiableValue',
          defaultValue: null,
          rateScheduleGroup: 'transfer-tax',
        }),
      }),
    ])
    expect(entry?.result.amount).toBe(39_187_00)
    expect(entry?.result.breakdown.kind).toBe('bracketed')
  })

  it('reports a bracketed cost with no schedule instead of charging nothing quietly', () => {
    const [entry] = evaluateCosts({
      rows: [
        row({
          costType: costType({
            calculationType: 'bracketed',
            defaultValue: null,
            rateScheduleGroup: 'land-tax',
          }),
        }),
      ],
      context,
      schedules: [schedule],
      scheduleIdByGroup,
    })
    expect(entry?.result.error?.code).toBe('SCHEDULE_NOT_FOUND')
  })

  it('calculates a percentage of the loan', () => {
    const [entry] = evaluate([
      row({
        costType: costType({
          calculationType: 'percentage',
          defaultValue: null,
          percentage: 0.012,
          calculationBase: 'loanAmount',
        }),
      }),
    ])
    expect(entry?.result.amount).toBe(9_600_00)
  })

  it('calculates a formula cost', () => {
    const [entry] = evaluate([
      row({
        costType: costType({
          calculationType: 'formula',
          defaultValue: null,
          formula: 'loanAmount * 0.005',
        }),
      }),
    ])
    expect(entry?.result.amount).toBe(4_000_00)
  })

  it('uses the entered amount for a manual cost', () => {
    const [entry] = evaluate([
      row({
        manualValue: 2_000_00,
        costType: costType({ calculationType: 'manual', defaultValue: null }),
      }),
    ])
    expect(entry?.result.amount).toBe(2_000_00)
  })

  describe('overrides', () => {
    it('wins over the calculated value while keeping it visible', () => {
      const [entry] = evaluate([row({ overrideValue: 750_00 })])
      expect(entry?.result.amount).toBe(750_00)
      expect(entry?.result.calculatedValue).toBe(600_00)
      expect(entry?.result.overridden).toBe(true)
    })

    it('returns to the calculated value when cleared', () => {
      const [entry] = evaluate([row({ overrideValue: null })])
      expect(entry?.result.amount).toBe(600_00)
      expect(entry?.result.overridden).toBe(false)
    })

    it('overrides a bracketed cost too, keeping the calculated figure alongside', () => {
      const [entry] = evaluate([
        row({
          overrideValue: 30_000_00,
          costType: costType({
            calculationType: 'bracketed',
            defaultValue: null,
            rateScheduleGroup: 'transfer-tax',
          }),
        }),
      ])
      expect(entry?.result.amount).toBe(30_000_00)
      expect(entry?.result.calculatedValue).toBe(39_187_00)
    })

    it('never mutates the cost type it was given', () => {
      const type = costType()
      evaluate([row({ overrideValue: 750_00, costType: type })])
      expect(type.defaultValue).toBe(600_00)
    })
  })

  it('orders by sort order, then name', () => {
    const results = evaluate([
      row({ id: 'b', sortOrder: 1, costType: costType({ name: 'Zebra' }) }),
      row({ id: 'a', sortOrder: 0, costType: costType({ name: 'Apple' }) }),
    ])
    expect(results.map((entry) => entry.row.id)).toEqual(['a', 'b'])
  })
})

describe('summariseUpfrontCosts', () => {
  const rows = [
    row({ id: 'a' }),
    row({
      id: 'b',
      sortOrder: 1,
      costType: costType({ id: 'ct-2', name: 'Pest', defaultValue: 400_00 }),
    }),
    row({
      id: 'c',
      sortOrder: 2,
      costType: costType({ id: 'ct-3', name: 'Legal', category: 'legal', defaultValue: 2_000_00 }),
    }),
  ]

  function summarise(input = rows, extra: { basis?: 'estimate' | 'actual' } = {}) {
    return summariseUpfrontCosts({
      rows: input,
      context,
      schedules: [schedule],
      scheduleIdByGroup,
      ...extra,
    })
  }

  it('totals the enabled costs and groups them', () => {
    const summary = summarise()
    expect(summary.total).toBe(3_000_00)
    expect(summary.byCategory).toEqual({ inspection: 1_000_00, legal: 2_000_00 })
  })

  it('leaves disabled costs out of the total', () => {
    const summary = summarise([
      rows[0] as PropertyCostRow,
      { ...(rows[1] as PropertyCostRow), enabled: false },
    ])
    expect(summary.total).toBe(600_00)
  })

  it('adds the deposit to the costs for the cash required', () => {
    const summary = summarise()
    expect(summary.deposit).toBe(200_000_00)
    expect(summary.cashRequired).toBe(203_000_00)
  })

  it('does not double count the deposit', () => {
    const summary = summarise()
    expect(summary.cashRequired).toBe(summary.deposit + summary.total)
    expect(summary.cashRequired).not.toBe(summary.deposit * 2 + summary.total)
  })

  it('totals the actual amounts when asked', () => {
    const withActual = [{ ...(rows[0] as PropertyCostRow), actualValue: 725_00 }]
    expect(summarise(withActual).total).toBe(600_00)
    expect(summarise(withActual, { basis: 'actual' }).total).toBe(725_00)
  })

  it('collects rows that failed to calculate', () => {
    const broken = [
      row({
        costType: costType({ calculationType: 'formula', defaultValue: null, formula: 'nope * 2' }),
      }),
    ]
    expect(summarise(broken).errors).toHaveLength(1)
  })
})
