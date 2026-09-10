import { getAppSettings } from '@repo/database'
import { DEFAULT_COST_CATEGORIES } from '@repo/property/defaults'
import { Badge, Button } from '@repo/ui'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { resolveNumberLocale } from '@/lib/number-format'
import { getPropertySettings } from '../../../settings/property/actions'
import { snapshotToEngineSchedule, toEngineSchedule } from '../../_lib/costs'
import { PROPERTY_STATUS_LABELS, PROPERTY_USE_LABELS } from '../../_lib/labels'
import { toPortfolioInput } from '../../_lib/portfolio'
import { PlannerWorkspace } from './_components/planner-workspace'
import { getPlannerData } from './actions'
import { listAvailableCostTypes, listPropertyCosts } from './costs-actions'
import { listAvailableFunds } from './funds-actions'
import { getRental, listRecurringCosts, listRecurringCostTypes } from './ongoing-actions'
import { listScenarios } from './scenarios-actions'

const CATEGORY_NAMES = Object.fromEntries(
  DEFAULT_COST_CATEGORIES.map((category) => [category.id, category.name]),
)

export const metadata = { title: 'Purchase planner' }

export default async function PlannerPage({ params }: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await params
  const data = await getPlannerData(propertyId)
  if (!data) notFound()

  const { property, others, jurisdiction, jurisdictions, transferTaxLabel, transferTaxSchedule } =
    data

  const [
    costRows,
    availableCostTypes,
    recurringRows,
    recurringTypes,
    rental,
    funds,
    scenarios,
    propertySettings,
    appSettings,
  ] = await Promise.all([
    listPropertyCosts(propertyId),
    listAvailableCostTypes(),
    listRecurringCosts(propertyId),
    listRecurringCostTypes(),
    getRental(propertyId),
    listAvailableFunds(),
    listScenarios(propertyId),
    getPropertySettings(),
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

  const isLet = property.intendedUse === 'investment' || property.intendedUse === 'mixed'

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

      <PlannerWorkspace
        property={property}
        jurisdictions={jurisdictions}
        transferTaxLabel={transferTaxLabel}
        activeSchedule={activeSchedule}
        costRows={costRows}
        availableCostTypes={availableCostTypes}
        categoryNames={CATEGORY_NAMES}
        recurringRows={recurringRows}
        recurringTypes={recurringTypes}
        rental={rental}
        isLet={isLet}
        funds={funds}
        scenarios={scenarios}
        others={others.map(toPortfolioInput)}
        sensitivityRates={propertySettings.sensitivityRates}
        maxPortfolioLvr={propertySettings.maxPortfolioLvr}
        locale={locale}
        purchaseLock={{
          scheduleId: transferTaxSchedule?.id ?? null,
          scheduleName: transferTaxSchedule?.name ?? null,
          completedAt: property.completedAt,
          snapshotName: snapshot?.name ?? null,
        }}
      />
    </div>
  )
}
