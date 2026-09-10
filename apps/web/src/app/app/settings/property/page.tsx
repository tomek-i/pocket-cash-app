import { getAppSettings } from '@repo/database'
import { Button } from '@repo/ui'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { resolveNumberLocale } from '@/lib/number-format'
import { CalculationSettings } from './_components/calculation-settings'
import { CostTypesSection } from './_components/cost-types-section'
import { JurisdictionsSection } from './_components/jurisdictions-section'
import { RateSchedulesSection } from './_components/rate-schedules-section'
import { getPropertySettings, listAllCostTypes, listAllJurisdictions } from './actions'
import { listRateSchedules } from './schedules-actions'

export const metadata = { title: 'Property settings' }

function Section({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="font-semibold text-lg">{title}</h2>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      {children}
    </section>
  )
}

export default async function PropertySettingsPage() {
  const [costTypes, jurisdictions, schedules, propertySettings, appSettings] = await Promise.all([
    listAllCostTypes(),
    listAllJurisdictions(),
    listRateSchedules(),
    getPropertySettings(),
    getAppSettings(),
  ])

  const currency = appSettings.defaultCurrency ?? jurisdictions[0]?.currency ?? 'USD'
  const locale = resolveNumberLocale(appSettings.numberLocale)

  return (
    <div className="flex flex-col gap-8 px-5 py-5 lg:px-8 lg:py-7">
      <div className="flex flex-col gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 h-7 w-fit gap-1.5 text-muted-foreground"
          render={<Link href="/app/settings" />}
          nativeButton={false}
        >
          <ArrowLeft className="size-3.5" />
          Settings
        </Button>
        <h1 className="font-semibold text-2xl tracking-tight">Property</h1>
        <p className="text-muted-foreground text-sm">
          The costs, places and defaults the purchase planner calculates from. Changing anything
          here changes what the planner offers, with no need for an app update.
        </p>
      </div>

      <Section
        title="Cost types"
        description="What the Add Cost lists offer. A name and a default value is enough; the rest is optional."
      >
        <CostTypesSection costTypes={costTypes} currency={currency} locale={locale} />
      </Section>

      <Section
        title="Jurisdictions"
        description="Places with their own rules. Each carries its own currency and its own name for the purchase tax, which is what keeps that terminology out of the calculation engine."
      >
        <JurisdictionsSection jurisdictions={jurisdictions} />
      </Section>

      <Section
        title="Rate schedules"
        description="Progressive rates, such as a transfer duty table. Each is dated, so a purchase always uses the rates that applied when it happened, and adding next year's rates leaves this year's alone."
      >
        <RateSchedulesSection schedules={schedules} jurisdictions={jurisdictions} locale={locale} />
      </Section>

      <Section
        title="Calculation defaults"
        description="Applied to a new property. Existing properties keep what they already have."
      >
        <CalculationSettings settings={propertySettings} />
      </Section>
    </div>
  )
}
