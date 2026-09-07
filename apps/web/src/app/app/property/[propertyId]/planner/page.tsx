import { Badge, Button } from '@repo/ui'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PROPERTY_STATUS_LABELS, PROPERTY_USE_LABELS } from '../../_lib/labels'
import { buildFinancing } from '../../_lib/planner'
import { DetailsPanel } from './_components/details-panel'
import { FinancingPanel } from './_components/financing-panel'
import { PlannerDashboard } from './_components/planner-dashboard'
import { getPlannerData } from './actions'

export const metadata = { title: 'Purchase planner' }

export default async function PlannerPage({ params }: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await params
  const data = await getPlannerData(propertyId)
  if (!data) notFound()

  const { property, jurisdiction, jurisdictions, transferTaxLabel, transferTaxSchedule } = data
  const loan = property.loans[0]

  // The dashboard shows the position as saved. The financing panel recalculates
  // live from its own inputs while the user edits.
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

      <PlannerDashboard result={result} currency={property.currency} />

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
        <FinancingPanel property={property} />
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-semibold text-lg">Upfront costs</h2>
          <p className="text-muted-foreground text-sm">
            {transferTaxSchedule
              ? `${transferTaxLabel} and the other purchase costs are added in the next step. The schedule that applies here is "${transferTaxSchedule.name}".`
              : `${transferTaxLabel} and the other purchase costs are added in the next step. No rate schedule is configured for this jurisdiction yet.`}
          </p>
        </div>
      </section>
    </div>
  )
}
