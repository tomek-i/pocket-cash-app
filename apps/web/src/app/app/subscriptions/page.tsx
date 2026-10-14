import { Badge, Button, Card, CardContent } from '@repo/ui'
import { Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { formatDate } from '@/lib/date-format'
import { getDateLocale } from '@/lib/date-locale'
import { formatMoney } from '@/lib/money'
import { Empty } from '../_components/empty'
import { ConfirmDeleteDialog } from '../banks/[bankId]/_components/confirm-delete-dialog'
import { listCategories } from '../categories/actions'
import { getDefaultCurrency } from '../settings/actions'
import { SubscriptionDialog } from './_components/subscription-dialog'
import { Suggestions } from './_components/suggestions'
import { CYCLE_LABELS, monthlyCost, type PaymentStatus } from './_lib/schedule'
import { loadPaymentStatuses } from './_lib/status'
import { deleteSubscription, listSubscriptions, suggestSubscriptions } from './actions'

export const metadata = { title: 'Subscriptions' }

function paymentLabel(status: PaymentStatus | undefined, locale: string): string | null {
  if (status?.kind === 'upcoming') return `next ${formatDate(status.date, locale)}`
  if (status?.kind === 'not-seen')
    return status.lastSeen
      ? `not seen since ${formatDate(status.lastSeen, locale)}`
      : 'not seen in your transactions'
  return null
}

export default async function SubscriptionsPage() {
  const [subscriptions, categories, detections, defaultCurrency] = await Promise.all([
    listSubscriptions(),
    listCategories(),
    suggestSubscriptions(),
    getDefaultCurrency(),
  ])
  const statuses = await loadPaymentStatuses(subscriptions)
  const locale = await getDateLocale()
  const monthlyTotal = subscriptions
    .filter((s) => s.active)
    .reduce((sum, s) => sum + monthlyCost(s.amount, s.cycle), 0)

  return (
    <div className="flex flex-col gap-6 px-5 py-5 lg:px-8 lg:py-7">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-semibold text-2xl tracking-tight">Subscriptions</h1>
          <p className="text-muted-foreground text-sm">Recurring bills like Netflix or Spotify.</p>
        </div>
        <SubscriptionDialog
          categories={categories}
          defaultCurrency={defaultCurrency}
          trigger={
            <Button className="gap-2">
              <Plus className="size-4" />
              Add subscription
            </Button>
          }
        />
      </div>

      <Suggestions detections={detections} />

      {subscriptions.length === 0 ? (
        <Card>
          <Empty
            className="p-12"
            icon={RefreshCw}
            title="No subscriptions yet"
            description="Add one manually, or track a detected subscription above."
            action={
              <SubscriptionDialog
                categories={categories}
                defaultCurrency={defaultCurrency}
                trigger={
                  <Button className="gap-2">
                    <Plus className="size-4" />
                    Add subscription
                  </Button>
                }
              />
            }
          />
        </Card>
      ) : (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-semibold text-lg">Tracked</h2>
            <p className="text-muted-foreground text-sm">
              <span className="font-medium text-foreground tabular-nums">
                {formatMoney(monthlyTotal, defaultCurrency)}
              </span>{' '}
              a month
            </p>
          </div>
          <div className="grid gap-2">
            {subscriptions.map((sub) => {
              const status = statuses.get(sub.id)
              const details = [
                CYCLE_LABELS[sub.cycle],
                paymentLabel(status, locale),
                sub.category?.name,
              ].filter(Boolean)
              return (
                <Card key={sub.id}>
                  <CardContent className="flex items-center justify-between gap-3 p-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                        <RefreshCw className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-sm">{sub.name}</p>
                        <p className="truncate text-muted-foreground text-xs">
                          {details.join(' · ')}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant="secondary" className="tabular-nums">
                        {formatMoney(sub.amount, sub.currency)}
                      </Badge>
                      <SubscriptionDialog
                        categories={categories}
                        subscription={
                          status?.kind === 'upcoming'
                            ? { ...sub, nextPaymentDate: status.date }
                            : sub
                        }
                        trigger={
                          <Button variant="ghost" size="icon" aria-label="Edit subscription">
                            <Pencil className="size-4" />
                          </Button>
                        }
                      />
                      <ConfirmDeleteDialog
                        action={deleteSubscription}
                        hidden={{ id: sub.id }}
                        title={`Delete “${sub.name}”?`}
                        description="This removes the subscription. Your transactions are untouched."
                        trigger={
                          <Button variant="ghost" size="icon" aria-label="Delete subscription">
                            <Trash2 className="size-4" />
                          </Button>
                        }
                      />
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
