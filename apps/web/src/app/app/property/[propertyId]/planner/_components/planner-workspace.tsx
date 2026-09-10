'use client'

import type { CostType, Jurisdiction, PropertyRental } from '@repo/database'
import type { RateSchedule } from '@repo/property'
import { useMemo } from 'react'
import { buildCostContext, type PropertyCostRow, summariseUpfrontCosts } from '../../../_lib/costs'
import { type AvailableFundRow, summariseFunds } from '../../../_lib/funds'
import { buildOngoing, type RecurringCostRow } from '../../../_lib/ongoing'
import { usePlannerInputs } from '../../../_lib/use-planner-inputs'
import type { PlannerProperty } from '../actions'
import { AvailableFunds } from './available-funds'
import { DetailsPanel } from './details-panel'
import { FinancingPanel } from './financing-panel'
import { OngoingCosts } from './ongoing-costs'
import { PlannerDashboard } from './planner-dashboard'
import { PurchaseLock } from './purchase-lock'
import { RateSensitivity } from './rate-sensitivity'
import { RentalIncome } from './rental-income'
import { UpfrontCosts } from './upfront-costs'

/**
 * The live half of the planner.
 *
 * The planner is a what-if tool: you push the price and the deposit around until
 * you can see what the purchase costs and what balance you would need. That only
 * works if everything moves together, so the working inputs are held here and
 * both the financing figures and the upfront costs are derived from them.
 *
 * Costs used to be evaluated on the server from the saved property, which left
 * transfer duty sitting still while the price moved. It is bracketed on the
 * purchase price, so it was exactly the wrong figure to freeze.
 *
 * Everything here is derived. Saving is still explicit, so modelling a purchase
 * writes nothing.
 */
export function PlannerWorkspace({
  property,
  jurisdictions,
  transferTaxLabel,
  activeSchedule,
  costRows,
  availableCostTypes,
  categoryNames,
  recurringRows,
  recurringTypes,
  rental,
  isLet,
  funds,
  sensitivityRates,
  locale,
  purchaseLock,
}: {
  property: PlannerProperty
  jurisdictions: Jurisdiction[]
  transferTaxLabel: string
  /** Resolved on the server: the snapshot for a completed purchase, else the dated schedule. */
  activeSchedule: RateSchedule | null
  costRows: PropertyCostRow[]
  availableCostTypes: CostType[]
  categoryNames: Record<string, string>
  recurringRows: RecurringCostRow[]
  recurringTypes: CostType[]
  rental: PropertyRental | undefined
  isLet: boolean
  funds: AvailableFundRow[]
  /** Decimal annual rates for the sensitivity table, from the calculation defaults. */
  sensitivityRates: number[]
  locale: string
  /** Locking is not part of the live model, but PurchaseLock is a client
   * component, so it is rendered here rather than passed down as an element. */
  purchaseLock: {
    scheduleId: string | null
    scheduleName: string | null
    completedAt: Date | null
    snapshotName: string | null
  }
}) {
  const loan = property.loans[0]
  const inputs = usePlannerInputs({
    purchasePrice: property.purchasePrice,
    estimatedMarketValue: property.estimatedMarketValue,
    currentValue: property.currentValue,
    loan,
  })

  const { financing } = inputs.result

  // The costs follow the working price and loan, not the saved ones.
  const costSummary = useMemo(
    () =>
      summariseUpfrontCosts({
        rows: costRows,
        context: buildCostContext({
          purchasePrice: financing.purchasePrice,
          propertyValue: inputs.result.propertyValue,
          loanAmount: financing.loanAmount,
          annualRate: inputs.result.terms.annualRate,
        }),
        schedules: activeSchedule ? [activeSchedule] : [],
        scheduleIdByGroup: activeSchedule ? { 'transfer-tax': activeSchedule.id } : {},
      }),
    [costRows, activeSchedule, financing, inputs.result],
  )

  const fundsSummary = useMemo(
    () => summariseFunds(funds, costSummary.cashRequired),
    [funds, costSummary.cashRequired],
  )

  // Year 1 interest and principal, not an average: interest falls over the life
  // of a loan, so the first year is the worst case and the one worth planning
  // against.
  const ongoing = useMemo(
    () =>
      buildOngoing({
        rows: recurringRows,
        rental: isLet && rental ? rental : null,
        propertyValue: inputs.result.propertyValue,
        annualInterest: inputs.result.amortisation.interestYear1,
        annualPrincipal: inputs.result.amortisation.principalYear1,
        monthlyRepayment: inputs.result.amortisation.monthlyRepayment,
      }),
    [recurringRows, rental, isLet, inputs.result],
  )

  return (
    <>
      <PlannerDashboard
        result={inputs.result}
        currency={property.currency}
        upfrontCosts={costSummary.total}
        cashRequired={costSummary.cashRequired}
        monthlyPropertyCosts={ongoing.recurring.monthly}
        monthlyRentalIncome={
          ongoing.cashFlow ? Math.round(ongoing.cashFlow.effectiveAnnualRent / 12) : null
        }
        monthlyCashFlow={ongoing.cashFlow?.monthlyCashFlow ?? null}
        availableCash={fundsSummary.total}
        remainingCash={fundsSummary.position.remaining}
      />

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-semibold text-lg">Property details</h2>
          <p className="text-muted-foreground text-sm">
            The jurisdiction decides which rules apply and what the purchase tax is called
            {transferTaxLabel ? `, here ${transferTaxLabel.toLowerCase()}` : ''}.
          </p>
        </div>
        <DetailsPanel property={property} jurisdictions={jurisdictions} />
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-semibold text-lg">Financing</h2>
          <p className="text-muted-foreground text-sm">
            Enter any one of deposit, deposit percentage or loan amount. The other two follow, and
            so do the costs below.
          </p>
        </div>
        <FinancingPanel property={property} locale={locale} inputs={inputs} />
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-semibold text-lg">Upfront costs</h2>
          <p className="text-muted-foreground text-sm">
            Everything payable to buy, on top of the price. {transferTaxLabel} is calculated from
            the rate schedule for this jurisdiction; every cost can be overridden.
          </p>
        </div>
        <PurchaseLock
          propertyId={property.id}
          scheduleId={purchaseLock.scheduleId}
          scheduleName={purchaseLock.scheduleName}
          completedAt={purchaseLock.completedAt}
          snapshotName={purchaseLock.snapshotName}
        />
        <UpfrontCosts
          locale={locale}
          propertyId={property.id}
          summary={costSummary}
          costTypes={availableCostTypes}
          categoryNames={categoryNames}
          currency={property.currency}
          purchasePrice={financing.purchasePrice}
          loanAmount={financing.loanAmount}
        />
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-semibold text-lg">Available funds</h2>
          <p className="text-muted-foreground text-sm">
            What you can put towards this, entered by hand. Everything above recalculates as you
            type, so a shortfall is something to push against rather than just read.
          </p>
        </div>
        <AvailableFunds summary={fundsSummary} currency={property.currency} locale={locale} />
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-semibold text-lg">If rates change</h2>
          <p className="text-muted-foreground text-sm">
            The repayment at other rates. Edit the bands in Settings, Property, calculation
            defaults.
          </p>
        </div>
        <RateSensitivity
          terms={inputs.result.terms}
          rates={sensitivityRates}
          currency={property.currency}
        />
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-semibold text-lg">Ongoing costs</h2>
          <p className="text-muted-foreground text-sm">
            What it costs to hold, whatever cadence the bill arrives at. Everything is normalised to
            monthly and annual figures.
          </p>
        </div>
        <OngoingCosts
          locale={locale}
          propertyId={property.id}
          summary={ongoing.recurring}
          costTypes={recurringTypes}
          currency={property.currency}
        />
      </section>

      {isLet ? (
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="font-semibold text-lg">Rental income</h2>
            <p className="text-muted-foreground text-sm">
              What it earns, after vacancy and management, and what that leaves once the holding
              costs and the loan are paid.
            </p>
          </div>
          <RentalIncome
            locale={locale}
            propertyId={property.id}
            rental={rental}
            cashFlow={ongoing.cashFlow}
            currency={property.currency}
          />
        </section>
      ) : null}
    </>
  )
}
