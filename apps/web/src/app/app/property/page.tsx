import { getAppSettings } from '@repo/database'
import { Button, Card, CardContent } from '@repo/ui'
import { Building2, Plus } from 'lucide-react'
import { formatMoney } from '@/lib/money'
import { Empty } from '../_components/empty'
import { PropertyCard } from './_components/property-card'
import { PropertyDialog } from './_components/property-dialog'
import { formatPercent } from './_lib/format'
import { PROPERTY_STATUS_LABELS } from './_lib/labels'
import { type PortfolioInput, portfolioTotals, propertyPosition } from './_lib/portfolio'
import { listJurisdictions, listProperties, type PropertyWithLoans } from './actions'

export const metadata = { title: 'Property' }

/** A property row plus its loans, reduced to what the portfolio maths needs. */
function toPortfolioInput(property: PropertyWithLoans): PortfolioInput {
  return {
    id: property.id,
    status: property.status,
    ownershipShare: property.ownershipShare,
    currentValue: property.currentValue,
    estimatedMarketValue: property.estimatedMarketValue,
    purchasePrice: property.purchasePrice,
    loanBalance: property.loans.reduce((total, loan) => total + loan.loanAmount, 0),
  }
}

function Summary({ label, value, tone }: { label: string; value: string; tone?: 'negative' }) {
  return (
    <div>
      <p className="text-muted-foreground text-sm">{label}</p>
      <p
        className={
          tone === 'negative'
            ? 'font-semibold text-2xl text-destructive tracking-tight'
            : 'font-semibold text-2xl tracking-tight'
        }
      >
        {value}
      </p>
    </div>
  )
}

export default async function PropertyPage() {
  const [properties, jurisdictions, settings] = await Promise.all([
    listProperties(),
    listJurisdictions(),
    getAppSettings(),
  ])

  const defaultCurrency = settings.defaultCurrency ?? 'USD'
  const inputs = properties.map(toPortfolioInput)
  const totals = portfolioTotals(inputs)
  // Totals are reported in the default currency. Mixed-currency portfolios need
  // conversion rates, which the app does not have, so a property in another
  // currency still shows its own figures on its card.
  const totalsCurrency = properties[0]?.currency ?? defaultCurrency

  const addButton = (
    <Button className="gap-2">
      <Plus className="size-4" />
      Add property
    </Button>
  )

  // Existing first, then what is being planned, then history.
  const groups = (['existing', 'planned', 'sold'] as const)
    .map((status) => ({
      status,
      items: properties.filter((property) => property.status === status),
    }))
    .filter((group) => group.items.length > 0)

  return (
    <div className="flex flex-col gap-6 px-5 py-5 lg:px-8 lg:py-7">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-semibold text-2xl tracking-tight">Property</h1>
          <p className="text-muted-foreground text-sm">
            What you own, what you are planning to buy, and where you stand.
          </p>
        </div>
        <PropertyDialog
          jurisdictions={jurisdictions}
          defaultCurrency={defaultCurrency}
          trigger={addButton}
        />
      </div>

      {properties.length === 0 ? (
        <Card>
          <Empty
            icon={Building2}
            title="No properties yet"
            description="Add a property you already own, or one you are thinking about buying."
            action={
              <PropertyDialog
                jurisdictions={jurisdictions}
                defaultCurrency={defaultCurrency}
                trigger={addButton}
              />
            }
          />
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
              <Summary label="Portfolio value" value={formatMoney(totals.value, totalsCurrency)} />
              <Summary label="Total debt" value={formatMoney(totals.debt, totalsCurrency)} />
              <Summary
                label="Equity"
                value={formatMoney(totals.equity, totalsCurrency)}
                tone={totals.equity < 0 ? 'negative' : undefined}
              />
              <Summary
                label="Portfolio LVR"
                value={totals.value > 0 ? formatPercent(totals.lvr) : '—'}
              />
            </CardContent>
          </Card>

          {groups.map((group) => (
            <section key={group.status} className="flex flex-col gap-3">
              <h2 className="font-medium text-muted-foreground text-sm">
                {PROPERTY_STATUS_LABELS[group.status]}
              </h2>
              <div className="grid gap-4 lg:grid-cols-2">
                {group.items.map((property) => (
                  <PropertyCard
                    key={property.id}
                    property={property}
                    position={propertyPosition(toPortfolioInput(property))}
                    jurisdictions={jurisdictions}
                  />
                ))}
              </div>
            </section>
          ))}
        </>
      )}
    </div>
  )
}
