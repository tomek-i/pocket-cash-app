import type { CostType } from '@repo/database'
import type { RateSchedule } from '@repo/property'
import { NSW_TRANSFER_DUTY_2026_27 } from '@repo/property/defaults'
import { describe, expect, it } from 'vitest'
import type { PropertyCostRow } from './costs'
import {
  applyOverrides,
  evaluateScenario,
  isEmptyOverrides,
  type ScenarioBase,
  type ScenarioContext,
} from './scenarios'

const schedule: RateSchedule = { ...NSW_TRANSFER_DUTY_2026_27, id: 'schedule-1' }

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

function costRow(overrides: Partial<PropertyCostRow> = {}): PropertyCostRow {
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

const base: ScenarioBase = {
  purchasePrice: 1_000_000_00,
  estimatedMarketValue: null,
  currentValue: null,
  source: 'depositPercentage',
  deposit: 200_000_00,
  depositPercentage: 0.2,
  loanAmount: 800_000_00,
  annualRate: 0.06,
  termYears: 30,
  loanType: 'principalAndInterest',
  offsetBalance: 0,
}

function context(overrides: Partial<ScenarioContext> = {}): ScenarioContext {
  return {
    costRows: [
      costRow(),
      costRow({
        id: 'pc-2',
        costTypeId: 'ct-2',
        sortOrder: 1,
        costType: costType({
          id: 'ct-2',
          key: 'transfer-duty',
          name: 'Transfer Duty',
          category: 'government',
          calculationType: 'bracketed',
          defaultValue: null,
          rateScheduleGroup: 'transfer-tax',
        }),
      }),
    ],
    schedules: [schedule],
    scheduleIdByGroup: { 'transfer-tax': 'schedule-1' },
    recurringRows: [
      {
        id: 'rc-1',
        name: 'Council rates',
        category: 'rates',
        amount: 500_00,
        frequency: 'quarterly',
        customPerYear: null,
        enabled: true,
      },
    ],
    rental: null,
    funds: [{ id: 'f-1', label: 'Savings', amount: 300_000_00, enabled: true }],
    ...overrides,
  }
}

const let_ = {
  rent: 900_00,
  rentFrequency: 'weekly' as const,
  rentCustomPerYear: null,
  vacancyRate: 0.02,
  managementRate: 0.066,
}

describe('applyOverrides', () => {
  it('leaves the base untouched when nothing is overridden', () => {
    expect(applyOverrides(base, {})).toEqual(base)
  })

  it('does not mutate the base', () => {
    applyOverrides(base, { purchasePrice: 2_000_000_00 })
    expect(base.purchasePrice).toBe(1_000_000_00)
  })

  it('takes the overridden price', () => {
    expect(applyOverrides(base, { purchasePrice: 1_100_000_00 }).purchasePrice).toBe(1_100_000_00)
  })

  it('makes a deposit override the field the rest is derived from', () => {
    const next = applyOverrides(base, { deposit: 250_000_00 })
    expect(next.deposit).toBe(250_000_00)
    expect(next.source).toBe('deposit')
  })

  it('makes a deposit percentage override the field the rest is derived from', () => {
    const next = applyOverrides({ ...base, source: 'deposit' }, { depositPercentage: 0.25 })
    expect(next.depositPercentage).toBe(0.25)
    expect(next.source).toBe('depositPercentage')
  })

  it('lets a loan amount override win over the other two', () => {
    const next = applyOverrides(base, { loanAmount: 700_000_00, deposit: 250_000_00 })
    expect(next.source).toBe('loanAmount')
    expect(next.loanAmount).toBe(700_000_00)
  })
})

describe('evaluateScenario', () => {
  it('reproduces the base exactly when it overrides nothing', () => {
    const ctx = context()
    const result = evaluateScenario(base, {}, ctx)

    expect(result.purchasePrice).toBe(1_000_000_00)
    expect(result.deposit).toBe(200_000_00)
    expect(result.loanAmount).toBe(800_000_00)
    expect(result.lvr).toBeCloseTo(0.8, 10)
  })

  it('recalculates duty from the scenario price rather than reusing the base figure', () => {
    const ctx = context()
    const at1m = evaluateScenario(base, {}, ctx)
    const at1_1m = evaluateScenario(base, { purchasePrice: 1_100_000_00 }, ctx)

    // A price rise of $100,000 costs more than the extra $100,000: the duty on
    // it follows too. If costs were carried over instead of recalculated, the
    // two totals would be identical.
    expect(at1_1m.upfrontCosts).toBeGreaterThan(at1m.upfrontCosts)
    expect(at1_1m.cashRequired - at1m.cashRequired).toBeGreaterThan(20_000_00)
  })

  it('trades a bigger deposit for a smaller loan', () => {
    const ctx = context()
    const twenty = evaluateScenario(base, {}, ctx)
    const thirty = evaluateScenario(base, { depositPercentage: 0.3 }, ctx)

    expect(thirty.deposit).toBe(300_000_00)
    expect(thirty.loanAmount).toBe(700_000_00)
    expect(thirty.lvr).toBeCloseTo(0.7, 10)
    expect(thirty.monthlyRepayment).toBeLessThan(twenty.monthlyRepayment)
    // The whole point of the comparison: cheaper monthly, dearer at settlement.
    expect(thirty.cashRequired).toBeGreaterThan(twenty.cashRequired)
    expect(thirty.remainingCash).toBeLessThan(twenty.remainingCash)
  })

  it('leaves the cash required alone when only the rate moves', () => {
    const ctx = context()
    const six = evaluateScenario(base, {}, ctx)
    const seven = evaluateScenario(base, { annualRate: 0.07 }, ctx)

    expect(seven.monthlyRepayment).toBeGreaterThan(six.monthlyRepayment)
    expect(seven.cashRequired).toBe(six.cashRequired)
  })

  it('reports a shortfall once the deposit outgrows the funds', () => {
    const ctx = context()
    expect(evaluateScenario(base, {}, ctx).shortfall).toBe(false)

    const stretched = evaluateScenario(base, { depositPercentage: 0.35 }, ctx)
    expect(stretched.shortfall).toBe(true)
    expect(stretched.remainingCash).toBeLessThan(0)
  })

  it('has no rental figures when the property is not let', () => {
    const result = evaluateScenario(base, {}, context())
    expect(result.monthlyRentalIncome).toBeNull()
    expect(result.monthlyCashFlow).toBeNull()
  })

  it('moves the cash flow with an overridden rent', () => {
    const ctx = context({ rental: let_ })
    const asIs = evaluateScenario(base, {}, ctx)
    const higher = evaluateScenario(base, { rent: 1_100_00 }, ctx)

    expect(asIs.monthlyRentalIncome).not.toBeNull()
    expect(higher.monthlyRentalIncome as number).toBeGreaterThan(asIs.monthlyRentalIncome as number)
    expect(higher.monthlyCashFlow as number).toBeGreaterThan(asIs.monthlyCashFlow as number)
  })

  it('ignores a rent override on a property that is not let', () => {
    const result = evaluateScenario(base, { rent: 1_100_00 }, context())
    expect(result.monthlyCashFlow).toBeNull()
  })

  it('carries the holding costs across unchanged, since they do not follow the price', () => {
    const ctx = context()
    const cheap = evaluateScenario(base, { purchasePrice: 900_000_00 }, ctx)
    const dear = evaluateScenario(base, { purchasePrice: 1_200_000_00 }, ctx)
    expect(cheap.monthlyPropertyCosts).toBe(dear.monthlyPropertyCosts)
  })
})

describe('isEmptyOverrides', () => {
  it('is true for a scenario that changes nothing', () => {
    expect(isEmptyOverrides({})).toBe(true)
  })

  it('is false once a field is set', () => {
    expect(isEmptyOverrides({ purchasePrice: 1_100_000_00 })).toBe(false)
  })

  it('is true when a field was cleared back to undefined', () => {
    expect(isEmptyOverrides({ purchasePrice: undefined })).toBe(true)
  })
})
