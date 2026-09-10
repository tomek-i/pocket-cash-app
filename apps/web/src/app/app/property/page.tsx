import { getAppSettings } from '@repo/database'
import { Button, Card, CardContent } from '@repo/ui'
import { Building2, Plus } from 'lucide-react'
import { formatMoney } from '@/lib/money'
import { resolveNumberLocale } from '@/lib/number-format'
import { Empty } from '../_components/empty'
import { getPropertySettings } from '../settings/property/actions'
import { PropertyCard } from './_components/property-card'
import { PropertyDialog } from './_components/property-dialog'
import { formatPercent } from './_lib/format'
import { PROPERTY_STATUS_LABELS } from './_lib/labels'
import {
  ownedProperties,
  portfolioTotals,
  propertyPosition,
  toPortfolioInput,
} from './_lib/portfolio'
import { portfolioImpact } from './_lib/portfolio-impact'
import { listJurisdictions, listProperties } from './actions'

export const metadata = { title: 'Property' }

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
  const [properties, jurisdictions, settings, propertySettings] = await Promise.all([
    listProperties(),
    listJurisdictions(),
    getAppSettings(),
    getPropertySettings(),
  ])

  const defaultCurrency = settings.defaultCurrency ?? 'USD'
  const locale = resolveNumberLocale(settings.numberLocale)
  const inputs = properties.map(toPortfolioInput)
  // Only what is actually held. A planned purchase used to be counted here, so
  // "Total debt" reported money that had not been borrowed. What each planned
  // purchase would do to these figures is on its own card instead.
  const totals = portfolioTotals(ownedProperties(inputs))
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
          locale={locale}
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
                locale={locale}
                trigger={addButton}
              />
            }
          />
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="flex flex-col gap-4 p-5">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Summary label="Value owned" value={formatMoney(totals.value, totalsCurrency)} />
                <Summary label="Debt owed" value={formatMoney(totals.debt, totalsCurrency)} />
                <Summary
                  label="Equity"
                  value={formatMoney(totals.equity, totalsCurrency)}
                  tone={totals.equity < 0 ? 'negative' : undefined}
                />
                <Summary
                  label="Portfolio LVR"
                  value={totals.value > 0 ? formatPercent(totals.lvr) : '—'}
                />
              </div>
              <p className="text-muted-foreground text-xs">
                What you hold today. A planned purchase shows what it would add on its own card.
              </p>
            </CardContent>
          </Card>

          {groups.map((group) => (
            <section key={group.status} className="flex flex-col gap-3">
              <h2 className="font-medium text-muted-foreground text-sm">
                {PROPERTY_STATUS_LABELS[group.status]}
              </h2>
              <div className="grid gap-4 lg:grid-cols-2">
                {group.items.map((property) => {
                  const input = toPortfolioInput(property)
                  const position = propertyPosition(input)

                  return (
                    <PropertyCard
                      key={property.id}
                      property={property}
                      position={position}
                      jurisdictions={jurisdictions}
                      locale={locale}
                      // Only a planned purchase has an "after". The cash it takes
                      // is not known here, which is what the planner is for.
                      impact={
                        property.status === 'planned'
                          ? portfolioImpact({
                              others: inputs.filter((other) => other.id !== property.id),
                              purchase: {
                                value: position.value,
                                debt: position.debt,
                                ownershipShare: property.ownershipShare,
                              },
                              maxLvr: propertySettings.maxPortfolioLvr,
                            })
                          : undefined
                      }
                    />
                  )
                })}
              </div>
            </section>
          ))}
        </>
      )}
    </div>
  )
}
