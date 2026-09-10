'use client'

import type { FinancingSource, LoanType } from '@repo/property'
import { useMemo, useState } from 'react'
import { toMajorInput, toMinorUnits, toPercentInput, toRateDecimal } from './format'
import { buildFinancing, type FinancingResult } from './planner'

/**
 * The planner's working inputs.
 *
 * These used to live inside the financing panel, which meant the upfront costs
 * could not see them: the costs were rendered on the server from the *saved*
 * property, so transfer duty sat still while the price moved. Transfer duty is
 * bracketed on the purchase price, so that is precisely the figure that has to
 * follow. Holding the inputs one level up lets both halves of the planner read
 * the same numbers as they are typed.
 *
 * Values are kept as the strings the user typed rather than as numbers, so a
 * half-finished "1." is not rounded to something else underneath them. Nothing
 * here writes to the database: saving stays a deliberate act.
 */

export type PlannerInputKey =
  | 'purchasePrice'
  | 'marketValue'
  | 'deposit'
  | 'depositPercentage'
  | 'loanAmount'
  | 'interestRate'
  | 'termYears'
  | 'offsetBalance'
  | 'otherCosts'

export type PlannerInputValues = Record<PlannerInputKey, string>

/** The stored property and loan the working inputs start from. */
export interface PlannerSeed {
  purchasePrice: number
  marketValue: number | null
  loan?: {
    loanAmount: number
    annualRate: number
    termYears: number
    loanType: LoanType
    offsetBalance: number
    otherFinancingCosts: number
  }
}

export interface PlannerInputs {
  values: PlannerInputValues
  loanType: LoanType
  /** Which of deposit, deposit percentage and loan amount the user last edited. */
  source: FinancingSource
  setValue: (key: PlannerInputKey, value: string) => void
  setLoanType: (value: LoanType) => void
  /** Edit one of the three linked figures, recording it as the one to derive from. */
  setFinancingValue: (source: FinancingSource, value: string) => void
  /** What the three linked fields should display: the edited one, plus two derived. */
  shown: { deposit: string; depositPercentage: string; loanAmount: string }
  result: FinancingResult
}

export function usePlannerInputs(seed: PlannerSeed): PlannerInputs {
  const { loan } = seed

  const [values, setValues] = useState<PlannerInputValues>(() => ({
    purchasePrice: toMajorInput(seed.purchasePrice),
    marketValue: toMajorInput(seed.marketValue),
    deposit: toMajorInput(seed.purchasePrice - (loan?.loanAmount ?? 0)),
    depositPercentage: seed.purchasePrice
      ? toPercentInput((seed.purchasePrice - (loan?.loanAmount ?? 0)) / seed.purchasePrice)
      : '20',
    loanAmount: toMajorInput(loan?.loanAmount ?? 0),
    interestRate: loan ? toPercentInput(loan.annualRate) : '6',
    termYears: loan ? String(loan.termYears) : '30',
    offsetBalance: toMajorInput(loan?.offsetBalance ?? 0),
    otherCosts: toMajorInput(loan?.otherFinancingCosts ?? 0),
  }))
  const [loanType, setLoanType] = useState<LoanType>(loan?.loanType ?? 'principalAndInterest')
  /**
   * A property that already has a loan is driven by that loan, not by a deposit.
   *
   * This used to always start from the deposit, which the seed clamped at zero.
   * A loan bigger than the recorded purchase price, normal on a property owned
   * for a while and refinanced since, clamped to a zero deposit and then had its
   * loan recomputed as the whole purchase price. The real loan was read to seed
   * the fields and then thrown away, so the planner and the portfolio reported
   * different LVRs for the same property.
   *
   * Modelling a purchase that has no loan yet still starts from a deposit, which
   * is the figure someone planning one actually has in mind.
   */
  const [source, setSource] = useState<FinancingSource>(loan ? 'loanAmount' : 'deposit')

  const setValue = (key: PlannerInputKey, value: string) =>
    setValues((current) => ({ ...current, [key]: value }))

  const setFinancingValue = (nextSource: FinancingSource, value: string) => {
    setSource(nextSource)
    const key: PlannerInputKey =
      nextSource === 'deposit'
        ? 'deposit'
        : nextSource === 'depositPercentage'
          ? 'depositPercentage'
          : 'loanAmount'
    setValue(key, value)
  }

  const result = useMemo(
    () =>
      buildFinancing({
        purchasePrice: toMinorUnits(values.purchasePrice),
        marketValue: values.marketValue ? toMinorUnits(values.marketValue) : null,
        source,
        deposit: toMinorUnits(values.deposit),
        depositPercentage: toRateDecimal(values.depositPercentage),
        loanAmount: toMinorUnits(values.loanAmount),
        annualRate: toRateDecimal(values.interestRate),
        termYears: Number.parseInt(values.termYears, 10) || 0,
        loanType,
        offsetBalance: toMinorUnits(values.offsetBalance),
      }),
    [values, loanType, source],
  )

  // The two fields the user is not editing follow the derived figures, so the
  // panel always shows a consistent set of three.
  const { financing } = result
  const shown = {
    deposit: source === 'deposit' ? values.deposit : toMajorInput(financing.deposit),
    depositPercentage:
      source === 'depositPercentage'
        ? values.depositPercentage
        : toPercentInput(financing.depositPercentage),
    loanAmount: source === 'loanAmount' ? values.loanAmount : toMajorInput(financing.loanAmount),
  }

  return { values, loanType, source, setValue, setLoanType, setFinancingValue, shown, result }
}
