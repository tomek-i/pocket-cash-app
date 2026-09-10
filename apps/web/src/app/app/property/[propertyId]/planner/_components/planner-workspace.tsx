'use client'

import type { CostType, Jurisdiction, PropertyRental, PropertyScenario } from '@repo/database'
import type { RateSchedule } from '@repo/property'
import { useMemo } from 'react'
import { buildCostContext, type PropertyCostRow, summariseUpfrontCosts } from '../../../_lib/costs'
import { toMinorUnits } from '../../../_lib/format'
import { type AvailableFundRow, summariseFunds } from '../../../_lib/funds'
import { buildOngoing, type RecurringCostRow } from '../../../_lib/ongoing'
import type { PortfolioInput } from '../../../_lib/portfolio'
import { portfolioImpact } from '../../../_lib/portfolio-impact'
import type { ScenarioBase, ScenarioContext } from '../../../_lib/scenarios'
import { usePlannerInputs } from '../../../_lib/use-planner-inputs'
import type { PlannerProperty } from '../actions'
import { AvailableFunds } from './available-funds'
import { DetailsPanel } from './details-panel'
import { FinancingPanel } from './financing-panel'
import { OngoingCosts } from './ongoing-costs'
import { PlannerDashboard } from './planner-dashboard'
import { PortfolioImpactPanel } from './portfolio-impact'
import { PurchaseLock } from './purchase-lock'
import { RateSensitivity } from './rate-sensitivity'
import { RentalIncome } from './rental-income'
import { ScenarioComparison } from './scenario-comparison'
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
  scenarios,
  others,
  sensitivityRates,
  maxPortfolioLvr,
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
  scenarios: PropertyScenario[]
  /** Every other property, for the portfolio impact panel. */
  others: PortfolioInput[]
  /** Decimal annual rates for the sensitivity table, from the calculation defaults. */
  sensitivityRates: number[]
  /** Decimal. The portfolio LVR a lender is assumed to go to. */
  maxPortfolioLvr: number
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

  // Resolved once and shared by the live costs and every scenario column. A fresh
  // object each render would defeat the memos below.
  const schedules = useMemo(() => (activeSchedule ? [activeSchedule] : []), [activeSchedule])
  const scheduleIdByGroup = useMemo(() => {
    const map: Record<string, string> = {}
    if (activeSchedule) map['transfer-tax'] = activeSchedule.id
    return map
  }, [activeSchedule])

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
        schedules,
        scheduleIdByGroup,
      }),
    [costRows, schedules, scheduleIdByGroup, financing, inputs.result],
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

  // Scenarios start from the *working* inputs, not the saved property, so a
  // comparison built while modelling compares against what is on screen. The
  // financing trio comes back resolved from the engine, so whichever of the
  // three the user is editing, all three agree.
  const scenarioBase: ScenarioBase = useMemo(
    () => ({
      purchasePrice: financing.purchasePrice,
      estimatedMarketValue: inputs.values.marketValue
        ? toMinorUnits(inputs.values.marketValue)
        : null,
      currentValue: property.currentValue,
      source: inputs.source,
      deposit: financing.deposit,
      depositPercentage: financing.depositPercentage,
      loanAmount: financing.loanAmount,
      annualRate: inputs.result.terms.annualRate,
      termYears: inputs.result.terms.termYears,
      loanType: inputs.loanType,
      offsetBalance: toMinorUnits(inputs.values.offsetBalance),
    }),
    [financing, inputs, property.currentValue],
  )

  const scenarioContext = useMemo<ScenarioContext>(
    () => ({
      costRows,
      schedules,
      scheduleIdByGroup,
      recurringRows,
      rental: isLet && rental ? rental : null,
      funds,
    }),
    [costRows, schedules, scheduleIdByGroup, recurringRows, rental, isLet, funds],
  )

  const impact = useMemo(
    () =>
      portfolioImpact({
        others,
        purchase: {
          // Measured at what it will be worth, not at what is being paid. Paying
          // over the valuation is a real loss and has to show as one.
          value: inputs.result.propertyValue,
          debt: financing.loanAmount,
          ownershipShare: property.ownershipShare,
        },
        cashRequired: costSummary.cashRequired,
        maxLvr: maxPortfolioLvr,
      }),
    [
      others,
      inputs.result.propertyValue,
      financing.loanAmount,
      property.ownershipShare,
      costSummary.cashRequired,
      maxPortfolioLvr,
    ],
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
        maxPortfolioLvr={maxPortfolioLvr}
      />

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-semibold text-lg">Portfolio impact</h2>
          <p className="text-muted-foreground text-sm">
            Where this purchase leaves everything else you own. Only properties you already hold
            count as Now, so a purchase you are still thinking about is not counted on both sides.
          </p>
        </div>
        <PortfolioImpactPanel
          impact={impact}
          currency={property.currency}
          maxLvr={maxPortfolioLvr}
        />
      </section>

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

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-semibold text-lg">Scenarios</h2>
          <p className="text-muted-foreground text-sm">
            The same property at a different price, deposit or rate, side by side. A scenario stores
            only what it changes, so everything above still flows into it.
          </p>
        </div>
        <ScenarioComparison
          propertyId={property.id}
          scenarios={scenarios}
          base={scenarioBase}
          context={scenarioContext}
          currency={property.currency}
          locale={locale}
          isLet={isLet}
          baseRent={rental?.rent ?? null}
          portfolio={{ others, ownershipShare: property.ownershipShare, maxLvr: maxPortfolioLvr }}
        />
      </section>
    </>
  )
}
