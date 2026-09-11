'use client'

import type { Jurisdiction } from '@repo/database'
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@repo/ui'
import { Building2, Pencil, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { formatMoney } from '@/lib/money'
import { formatPercent } from '../_lib/format'
import { PROPERTY_TYPE_LABELS, PROPERTY_USE_LABELS } from '../_lib/labels'
import type { PropertyPosition } from '../_lib/portfolio'
import type { PortfolioImpact } from '../_lib/portfolio-impact'
import type { PropertyWithLoans } from '../actions'
import { DeletePropertyDialog } from './delete-property-dialog'
import { PropertyDialog } from './property-dialog'

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'negative' }) {
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className={tone === 'negative' ? 'font-medium text-destructive' : 'font-medium'}>
        {value}
      </p>
    </div>
  )
}

/**
 * What buying this would do to the rest of the portfolio.
 *
 * One line rather than a table, because this is a list. The full before and
 * after, and what the purchase costs in cash, is on the planner.
 */
function IfYouBuy({ impact, currency }: { impact: PortfolioImpact; currency: string }) {
  const { change, now, after } = impact
  const signed = (value: number) =>
    `${value >= 0 ? '+' : '-'}${formatMoney(Math.abs(value), currency)}`

  return (
    <div className="border-t pt-3">
      <p className="text-muted-foreground text-xs">If you buy this</p>
      <p className="mt-1 text-sm">
        <span className="tabular-nums">Debt {signed(change.debt)}</span>
        <span className="text-muted-foreground"> · </span>
        <span className={change.equity < 0 ? 'text-destructive tabular-nums' : 'tabular-nums'}>
          Equity {signed(change.equity)}
        </span>
        <span className="text-muted-foreground"> · </span>
        <span className="tabular-nums">
          Portfolio LVR {now.value > 0 ? formatPercent(now.lvr) : '—'} to{' '}
          {after.value > 0 ? formatPercent(after.lvr) : '—'}
        </span>
      </p>
    </div>
  )
}

/**
 * Where an offset account leaves you.
 *
 * Shown alongside the headline figures rather than replacing them, because the
 * two answer different questions. You still owe the full loan, and a lender
 * still reads LVR on it, so those stay as they are. What the offset changes is
 * where you actually stand, and that was not visible anywhere on this card.
 */
function WithOffset({ position, currency }: { position: PropertyPosition; currency: string }) {
  return (
    <div className="border-t pt-3">
      <p className="text-muted-foreground text-xs">With the offset account</p>
      <p className="mt-1 text-sm">
        <span className="tabular-nums">Offset {formatMoney(position.offset, currency)}</span>
        <span className="text-muted-foreground"> · </span>
        <span className="tabular-nums">Debt {formatMoney(position.netDebt, currency)}</span>
        <span className="text-muted-foreground"> · </span>
        <span className="tabular-nums">Equity {formatMoney(position.netEquity, currency)}</span>
      </p>
    </div>
  )
}

export function PropertyCard({
  property,
  position,
  jurisdictions,
  locale,
  impact,
}: {
  property: PropertyWithLoans
  position: PropertyPosition
  jurisdictions: Jurisdiction[]
  locale: string
  /** Present only for a planned purchase. */
  impact?: PortfolioImpact
}) {
  const place = [property.region, property.country].filter(Boolean).join(', ')

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-2">
        <Link
          href={`/app/property/${property.id}/planner`}
          className="flex min-w-0 items-center gap-3"
        >
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Building2 className="size-4" />
          </div>
          <div className="min-w-0">
            <CardTitle className="truncate text-base">{property.name}</CardTitle>
            <p className="truncate text-muted-foreground text-xs">
              {property.address || place || '—'}
            </p>
          </div>
        </Link>
        <div className="flex shrink-0 gap-1">
          <PropertyDialog
            property={property}
            jurisdictions={jurisdictions}
            locale={locale}
            trigger={
              <Button variant="ghost" size="icon" aria-label="Edit property">
                <Pencil className="size-4" />
              </Button>
            }
          />
          <DeletePropertyDialog
            property={property}
            trigger={
              <Button variant="ghost" size="icon" aria-label="Delete property">
                <Trash2 className="size-4" />
              </Button>
            }
          />
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline">{PROPERTY_TYPE_LABELS[property.type]}</Badge>
          <Badge variant="outline">{PROPERTY_USE_LABELS[property.intendedUse]}</Badge>
          {property.ownershipShare < 1 ? (
            <Badge variant="outline">{formatPercent(property.ownershipShare)} owned</Badge>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-3">
          <Stat label="Value" value={formatMoney(position.value, property.currency)} />
          <Stat label="Loan" value={formatMoney(position.debt, property.currency)} />
          <Stat
            label="Equity"
            value={formatMoney(position.equity, property.currency)}
            tone={position.equity < 0 ? 'negative' : undefined}
          />
          <Stat label="LVR" value={position.value > 0 ? formatPercent(position.lvr) : '—'} />
        </div>

        {position.offset > 0 ? (
          <WithOffset position={position} currency={property.currency} />
        ) : null}

        {impact ? <IfYouBuy impact={impact} currency={property.currency} /> : null}
      </CardContent>
    </Card>
  )
}
