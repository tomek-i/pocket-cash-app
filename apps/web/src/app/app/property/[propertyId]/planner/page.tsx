import { getAppSettings } from '@repo/database'
import { DEFAULT_COST_CATEGORIES } from '@repo/property/defaults'
import { Badge, Button } from '@repo/ui'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { resolveNumberLocale } from '@/lib/number-format'
import {
  buildCostContext,
  snapshotToEngineSchedule,
  summariseUpfrontCosts,
  toEngineSchedule,
} from '../../_lib/costs'
import { PROPERTY_STATUS_LABELS, PROPERTY_USE_LABELS } from '../../_lib/labels'
import { buildOngoing } from '../../_lib/ongoing'
import { buildFinancing } from '../../_lib/planner'
import { DetailsPanel } from './_components/details-panel'
import { FinancingPanel } from './_components/financing-panel'
import { OngoingCosts } from './_components/ongoing-costs'
import { PlannerDashboard } from './_components/planner-dashboard'
import { PurchaseLock } from './_components/purchase-lock'
import { RentalIncome } from './_components/rental-income'
import { UpfrontCosts } from './_components/upfront-costs'
import { getPlannerData } from './actions'
import { listAvailableCostTypes, listPropertyCosts } from './costs-actions'
import { getRental, listRecurringCosts, listRecurringCostTypes } from './ongoing-actions'

const CATEGORY_NAMES = Object.fromEntries(
  DEFAULT_COST_CATEGORIES.map((category) => [category.id, category.name]),
)

export const metadata = { title: 'Purchase planner' }

export default async function PlannerPage({ params }: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await params
  const data = await getPlannerData(propertyId)
  if (!data) notFound()

  const { property, jurisdiction, jurisdictions, transferTaxLabel, transferTaxSchedule } = data
  const loan = property.loans[0]

  const [costRows, availableCostTypes, recurringRows, recurringTypes, rental, appSettings] =
    await Promise.all([
      listPropertyCosts(propertyId),
      listAvailableCostTypes(),
      listRecurringCosts(propertyId),
      listRecurringCostTypes(),
      getRental(propertyId),
      getAppSettings(),
    ])

  const locale = resolveNumberLocale(appSettings.numberLocale)

  // A completed purchase reads its frozen snapshot. Everything else follows the
  // schedule in force on the purchase date. This is the one place that choice is
  // made, so historical figures cannot drift.
  const snapshot = property.completedAt ? property.rateScheduleSnapshot : null
  const activeSchedule = snapshot
    ? snapshotToEngineSchedule(
        snapshot,
        property.jurisdictionKey ?? '',
        property.country,
        property.region,
      )
    : transferTaxSchedule
      ? toEngineSchedule(transferTaxSchedule, property.country, property.region)
      : null

  const costSummary = summariseUpfrontCosts({
    rows: costRows,
    context: buildCostContext({
      purchasePrice: property.purchasePrice,
      propertyValue: property.estimatedMarketValue ?? property.purchasePrice,
      loanAmount: loan?.loanAmount ?? 0,
      annualRate: loan?.annualRate ?? 0,
    }),
    schedules: activeSchedule ? [activeSchedule] : [],
    scheduleIdByGroup: activeSchedule ? { 'transfer-tax': activeSchedule.id } : {},
  })

  const result = buildFinancing({
    purchasePrice: property.purchasePrice,
    estimatedMarketValue: property.estimatedMarketValue,
    currentValue: property.currentValue,
    source: 'loanAmount',
    deposit: 0,
    depositPercentage: 0,
    loanAmount: loan?.loanAmount ?? 0,
    annualRate: loan?.annualRate ?? 0,
    termYears: loan?.termYears ?? 30,
    loanType: loan?.loanType ?? 'principalAndInterest',
    offsetBalance: loan?.offsetBalance ?? 0,
  })

  // Year 1 interest and principal, not an average: interest falls over the life
  // of a loan, so the first year is the worst case and the one worth planning
  // against.
  const isLet = property.intendedUse === 'investment' || property.intendedUse === 'mixed'
  const ongoing = buildOngoing({
    rows: recurringRows,
    rental: isLet && rental ? rental : null,
    propertyValue: result.propertyValue,
    annualInterest: result.amortisation.interestYear1,
    annualPrincipal: result.amortisation.principalYear1,
    monthlyRepayment: result.amortisation.monthlyRepayment,
  })

  // The dashboard shows the position as saved. The financing panel recalculates
  // live from its own inputs while the user edits.

  return (
    <div className="flex flex-col gap-6 px-5 py-5 lg:px-8 lg:py-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 h-7 w-fit gap-1.5 text-muted-foreground"
            render={<Link href="/app/property" />}
            nativeButton={false}
          >
            <ArrowLeft className="size-3.5" />
            Property
          </Button>
          <h1 className="font-semibold text-2xl tracking-tight">{property.name}</h1>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary">{PROPERTY_STATUS_LABELS[property.status]}</Badge>
            <Badge variant="outline">{PROPERTY_USE_LABELS[property.intendedUse]}</Badge>
            {jurisdiction ? <Badge variant="outline">{jurisdiction.name}</Badge> : null}
          </div>
        </div>
      </div>

      <PlannerDashboard
        result={result}
        currency={property.currency}
        upfrontCosts={costSummary.total}
        cashRequired={costSummary.cashRequired}
        monthlyPropertyCosts={ongoing.recurring.monthly}
        monthlyRentalIncome={
          ongoing.cashFlow ? Math.round(ongoing.cashFlow.effectiveAnnualRent / 12) : null
        }
        monthlyCashFlow={ongoing.cashFlow?.monthlyCashFlow ?? null}
      />

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-semibold text-lg">Property details</h2>
          <p className="text-muted-foreground text-sm">
            The jurisdiction decides which rules apply and what the purchase tax is called
            {jurisdiction ? `, here ${transferTaxLabel.toLowerCase()}` : ''}.
          </p>
        </div>
        <DetailsPanel property={property} jurisdictions={jurisdictions} />
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-semibold text-lg">Financing</h2>
          <p className="text-muted-foreground text-sm">
            Enter any one of deposit, deposit percentage or loan amount. The other two follow.
          </p>
        </div>
        <FinancingPanel property={property} locale={locale} />
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
          scheduleId={transferTaxSchedule?.id ?? null}
          scheduleName={transferTaxSchedule?.name ?? null}
          completedAt={property.completedAt}
          snapshotName={snapshot?.name ?? null}
        />
        <UpfrontCosts
          locale={locale}
          propertyId={property.id}
          summary={costSummary}
          costTypes={availableCostTypes}
          categoryNames={CATEGORY_NAMES}
          currency={property.currency}
          purchasePrice={property.purchasePrice}
          loanAmount={loan?.loanAmount ?? 0}
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
    </div>
  )
}
