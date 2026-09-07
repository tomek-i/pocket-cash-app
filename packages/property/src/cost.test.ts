import { describe, expect, it } from 'vitest'
import {
  type CostDefinition,
  type CostState,
  calculateCost,
  cashPosition,
  cashRequired,
  summariseCosts,
} from './cost'
import type { CalculationContext, RateSchedule } from './types'

const context: CalculationContext = {
  purchasePrice: 1_000_000_00,
  propertyValue: 1_000_000_00,
  loanAmount: 800_000_00,
  deposit: 200_000_00,
  dutiableValue: 1_000_000_00,
  lvr: 0.8,
  interestRate: 0.06,
}

const enabled: CostState = { enabled: true }

/** A small non-Australian schedule: 1% flat above zero. */
const schedule: RateSchedule = {
  id: 'test-schedule',
  name: 'Test Purchase Tax',
  jurisdiction: 'XX-TEST',
  country: 'XX',
  region: 'TEST',
  currency: 'USD',
  effectiveFrom: '2020-01-01',
  effectiveTo: null,
  calculationType: 'bracketed',
  version: 1,
  brackets: [{ minimum: 0, maximum: null, baseAmount: 0, rate: 0.01, rateUnit: 'percentage' }],
}

describe('calculateCost', () => {
  it('uses the default for a fixed cost', () => {
    const definition: CostDefinition = {
      id: 'inspection',
      name: 'Building Inspection',
      category: 'inspection',
      calculationType: 'fixed',
      defaultValue: 600_00,
    }
    const result = calculateCost(definition, enabled, context)
    expect(result.amount).toBe(600_00)
    expect(result.calculatedValue).toBe(600_00)
    expect(result.automatic).toBe(false)
    expect(result.overridden).toBe(false)
  })

  it('uses the entered amount for a manual cost', () => {
    const definition: CostDefinition = {
      id: 'conveyancing',
      name: 'Conveyancing',
      category: 'legal',
      calculationType: 'manual',
    }
    const result = calculateCost(definition, { enabled: true, manualValue: 2_000_00 }, context)
    expect(result.amount).toBe(2_000_00)
    expect(result.calculatedValue).toBeNull()
    expect(result.breakdown.kind).toBe('manual')
  })

  it('calculates a percentage of the configured base', () => {
    const definition: CostDefinition = {
      id: 'lmi',
      name: 'Mortgage Insurance',
      category: 'insurance',
      calculationType: 'percentage',
      percentage: 0.012,
      calculationBase: 'loanAmount',
    }
    const result = calculateCost(definition, enabled, context)
    expect(result.amount).toBe(9_600_00)
    expect(result.automatic).toBe(true)
    expect(result.breakdown).toMatchObject({ kind: 'percentage', baseValue: 800_000_00 })
  })

  it('calculates a formula cost', () => {
    const definition: CostDefinition = {
      id: 'bank-fee',
      name: 'Bank Fee',
      category: 'financing',
      calculationType: 'formula',
      formula: 'loanAmount * 0.005',
    }
    expect(calculateCost(definition, enabled, context).amount).toBe(4_000_00)
  })

  it('reports a broken formula instead of silently charging nothing', () => {
    const definition: CostDefinition = {
      id: 'broken',
      name: 'Broken',
      category: 'other',
      calculationType: 'formula',
      formula: 'councilRate * 2',
    }
    const result = calculateCost(definition, enabled, context)
    expect(result.error?.code).toBe('UNKNOWN_VARIABLE')
    expect(result.calculatedValue).toBeNull()
    expect(result.amount).toBe(0)
  })

  it('calculates a bracketed cost from its rate schedule', () => {
    const definition: CostDefinition = {
      id: 'transfer-duty',
      name: 'Transfer Duty',
      category: 'government',
      calculationType: 'bracketed',
      calculationBase: 'dutiableValue',
      rateScheduleId: 'test-schedule',
    }
    const result = calculateCost(definition, enabled, context, { schedules: [schedule] })
    expect(result.amount).toBe(10_000_00)
    expect(result.breakdown.kind).toBe('bracketed')
  })

  it('reports a missing rate schedule', () => {
    const definition: CostDefinition = {
      id: 'transfer-duty',
      name: 'Transfer Duty',
      category: 'government',
      calculationType: 'bracketed',
      rateScheduleId: 'not-seeded',
    }
    const result = calculateCost(definition, enabled, context, { schedules: [schedule] })
    expect(result.error?.code).toBe('SCHEDULE_NOT_FOUND')
  })

  describe('overrides', () => {
    const definition: CostDefinition = {
      id: 'inspection',
      name: 'Building Inspection',
      category: 'inspection',
      calculationType: 'fixed',
      defaultValue: 600_00,
    }

    it('lets an override win while keeping the default visible', () => {
      const result = calculateCost(definition, { enabled: true, overrideValue: 750_00 }, context)
      expect(result.amount).toBe(750_00)
      expect(result.calculatedValue).toBe(600_00)
      expect(result.overridden).toBe(true)
    })

    it('returns to the calculated value once the override is cleared', () => {
      const result = calculateCost(definition, { enabled: true, overrideValue: null }, context)
      expect(result.amount).toBe(600_00)
      expect(result.overridden).toBe(false)
    })

    it('does not mutate the definition it was given', () => {
      calculateCost(definition, { enabled: true, overrideValue: 750_00 }, context)
      expect(definition.defaultValue).toBe(600_00)
    })

    it('overrides a calculated cost too', () => {
      const duty: CostDefinition = {
        id: 'transfer-duty',
        name: 'Transfer Duty',
        category: 'government',
        calculationType: 'bracketed',
        rateScheduleId: 'test-schedule',
      }
      const result = calculateCost(duty, { enabled: true, overrideValue: 1_00 }, context, {
        schedules: [schedule],
      })
      expect(result.amount).toBe(1_00)
      expect(result.calculatedValue).toBe(10_000_00)
    })

    it('treats an override of zero as a real override, not as absent', () => {
      const result = calculateCost(definition, { enabled: true, overrideValue: 0 }, context)
      expect(result.overridden).toBe(true)
      expect(result.amount).toBe(0)
    })
  })

  describe('estimate versus actual', () => {
    const definition: CostDefinition = {
      id: 'inspection',
      name: 'Building Inspection',
      category: 'inspection',
      calculationType: 'fixed',
      defaultValue: 600_00,
    }
    const state: CostState = { enabled: true, actualValue: 725_00 }

    it('totals the estimate by default', () => {
      expect(calculateCost(definition, state, context).amount).toBe(600_00)
    })

    it('totals the actual when asked', () => {
      expect(calculateCost(definition, state, context, { basis: 'actual' }).amount).toBe(725_00)
    })

    it('falls back to the estimate when no actual is recorded', () => {
      const result = calculateCost(definition, enabled, context, { basis: 'actual' })
      expect(result.amount).toBe(600_00)
      expect(result.actual).toBeNull()
    })
  })
})

describe('summariseCosts', () => {
  const definitions: CostDefinition[] = [
    {
      id: 'a',
      name: 'A',
      category: 'inspection',
      calculationType: 'fixed',
      defaultValue: 600_00,
    },
    {
      id: 'b',
      name: 'B',
      category: 'inspection',
      calculationType: 'fixed',
      defaultValue: 400_00,
    },
    { id: 'c', name: 'C', category: 'legal', calculationType: 'fixed', defaultValue: 2_000_00 },
  ]

  it('totals enabled costs and groups them by category', () => {
    const costs = definitions.map((definition) => calculateCost(definition, enabled, context))
    const summary = summariseCosts(costs)
    expect(summary.total).toBe(3_000_00)
    expect(summary.byCategory).toEqual({ inspection: 1_000_00, legal: 2_000_00 })
  })

  it('excludes disabled costs from the total', () => {
    const costs = definitions.map((definition, index) =>
      calculateCost(definition, { enabled: index !== 0 }, context),
    )
    expect(summariseCosts(costs).total).toBe(2_400_00)
  })

  it('collects costs that failed to calculate', () => {
    const broken = calculateCost(
      {
        id: 'broken',
        name: 'Broken',
        category: 'other',
        calculationType: 'formula',
        formula: 'nope',
      },
      enabled,
      context,
    )
    expect(summariseCosts([broken]).errors).toHaveLength(1)
  })
})

describe('cashRequired', () => {
  it('is the deposit plus the upfront costs', () => {
    const result = cashRequired({
      purchasePrice: 1_000_000_00,
      upfrontCosts: 50_000_00,
      loanAmount: 800_000_00,
    })
    expect(result.deposit).toBe(200_000_00)
    expect(result.total).toBe(250_000_00)
  })

  it('does not double count the deposit', () => {
    // The single easiest mistake in this feature: adding the deposit to a total
    // that already contains it via `purchasePrice - loanAmount`.
    const purchasePrice = 1_000_000_00
    const loanAmount = 800_000_00
    const upfrontCosts = 50_000_00
    const deposit = purchasePrice - loanAmount

    const result = cashRequired({ purchasePrice, upfrontCosts, loanAmount })
    expect(result.total).toBe(deposit + upfrontCosts)
    expect(result.total).not.toBe(deposit + deposit + upfrontCosts)
  })

  it('needs the whole price in cash when there is no loan', () => {
    const result = cashRequired({
      purchasePrice: 1_000_000_00,
      upfrontCosts: 50_000_00,
      loanAmount: 0,
    })
    expect(result.total).toBe(1_050_000_00)
  })
})

describe('cashPosition', () => {
  it('reports what is left over', () => {
    const result = cashPosition(300_000_00, 250_000_00)
    expect(result.remaining).toBe(50_000_00)
    expect(result.shortfall).toBe(false)
  })

  it('flags a shortfall', () => {
    const result = cashPosition(200_000_00, 250_000_00)
    expect(result.remaining).toBe(-50_000_00)
    expect(result.shortfall).toBe(true)
  })

  it('does not flag an exact match as a shortfall', () => {
    expect(cashPosition(250_000_00, 250_000_00).shortfall).toBe(false)
  })
})
