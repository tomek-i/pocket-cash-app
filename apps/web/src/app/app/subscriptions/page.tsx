import { Badge, Button, Card, CardContent, cn } from '@repo/ui'
import { CirclePause, CircleStop, Pencil, Plus, RefreshCw, Trash2, Zap } from 'lucide-react'
import { formatDate } from '@/lib/date-format'
import { getDateLocale } from '@/lib/date-locale'
import { formatMoney } from '@/lib/money'
import { Empty } from '../_components/empty'
import { ConfirmDeleteDialog } from '../banks/[bankId]/_components/confirm-delete-dialog'
import { listCategories } from '../categories/actions'
import { getDefaultCurrency } from '../settings/actions'
import { ApplyCategoriesButton } from './_components/apply-categories-button'
import { StatusMenu } from './_components/status-menu'
import { SubscriptionDialog } from './_components/subscription-dialog'
import { Suggestions } from './_components/suggestions'
import {
  CYCLE_LABELS,
  KIND_LABELS,
  type Lifecycle,
  lifecycle,
  monthlyCost,
  type PaymentStatus,
  todayIso,
} from './_lib/schedule'
import { loadPaymentStatuses } from './_lib/status'
import {
  deleteSubscription,
  listSubscriptions,
  type SubscriptionWithCategory,
  suggestSubscriptions,
} from './actions'

export const metadata = { title: 'Subscriptions & bills' }

function paymentLabel(status: PaymentStatus | undefined, locale: string): string | null {
  if (status?.kind === 'upcoming') return `next ${formatDate(status.date, locale)}`
  if (status?.kind === 'not-seen')
    return status.lastSeen
      ? `not seen since ${formatDate(status.lastSeen, locale)}`
      : 'not seen in your transactions'
  return null
}

function lifecycleLabel(state: Lifecycle, locale: string): string | null {
  if (state.kind === 'active')
    return state.endsOn ? `ends ${formatDate(state.endsOn, locale)}` : null
  if (state.kind === 'paused')
    return state.until
      ? `paused until ${formatDate(state.until, locale)}`
      : 'paused until you resume it'
  return state.endedOn ? `ended ${formatDate(state.endedOn, locale)}` : 'cancelled'
}

const STATE_ICONS = { paused: CirclePause, cancelled: CircleStop }
const KIND_ICONS = { subscription: RefreshCw, bill: Zap }

export default async function SubscriptionsPage() {
  const [subscriptions, categories, detections, defaultCurrency] = await Promise.all([
    listSubscriptions(),
    listCategories(),
    suggestSubscriptions(),
    getDefaultCurrency(),
  ])
  const statuses = await loadPaymentStatuses(subscriptions)
  const locale = await getDateLocale()
  const today = todayIso()

  const rows = subscriptions.map((sub) => ({ sub, state: lifecycle(sub, today) }))
  const groups = {
    subscriptions: rows.filter((r) => r.state.kind === 'active' && r.sub.kind === 'subscription'),
    bills: rows.filter((r) => r.state.kind === 'active' && r.sub.kind === 'bill'),
    paused: rows.filter((r) => r.state.kind === 'paused'),
    cancelled: rows.filter((r) => r.state.kind === 'cancelled'),
  }
  const monthlyTotal = (list: typeof rows) =>
    list.reduce((sum, { sub }) => sum + monthlyCost(sub.amount, sub.cycle), 0)

  function renderCard({ sub, state }: { sub: SubscriptionWithCategory; state: Lifecycle }) {
    const status = statuses.get(sub.id)
    const muted = state.kind !== 'active'
    const details = [
      // Paused and cancelled groups mix both types.
      muted ? KIND_LABELS[sub.kind] : null,
      CYCLE_LABELS[sub.cycle],
      lifecycleLabel(state, locale),
      paymentLabel(status, locale),
      sub.category?.name,
    ].filter(Boolean)
    const Icon = state.kind === 'active' ? KIND_ICONS[sub.kind] : STATE_ICONS[state.kind]
    return (
      <Card key={sub.id}>
        <CardContent className="flex items-center justify-between gap-3 p-4">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className={cn(
                'flex size-9 shrink-0 items-center justify-center rounded-lg',
                muted ? 'bg-muted text-muted-foreground' : 'bg-primary/15 text-primary',
              )}
            >
              <Icon className="size-4" />
            </div>
            <div className="min-w-0">
              <p className={cn('truncate font-medium text-sm', muted && 'text-muted-foreground')}>
                {sub.name}
              </p>
              <p className="truncate text-muted-foreground text-xs">{details.join(' · ')}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge variant={muted ? 'outline' : 'secondary'} className="tabular-nums">
              {formatMoney(sub.amount, sub.currency)}
            </Badge>
            <SubscriptionDialog
              categories={categories}
              subscription={
                status?.kind === 'upcoming' && state.kind === 'active'
                  ? { ...sub, nextPaymentDate: status.date }
                  : sub
              }
              trigger={
                <Button variant="ghost" size="icon" aria-label="Edit subscription">
                  <Pencil className="size-4" />
                </Button>
              }
            />
            <StatusMenu id={sub.id} state={state} />
            <ConfirmDeleteDialog
              action={deleteSubscription}
              hidden={{ id: sub.id }}
              title={`Delete “${sub.name}”?`}
              description="This removes the subscription and its history. To keep it, cancel it instead. Your transactions are untouched."
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
  }

  return (
    <div className="flex flex-col gap-6 px-5 py-5 lg:px-8 lg:py-7">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-semibold text-2xl tracking-tight">Subscriptions & bills</h1>
          <p className="text-muted-foreground text-sm">
            Recurring payments, from Netflix to the power bill.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <SubscriptionDialog
            categories={categories}
            defaultCurrency={defaultCurrency}
            defaultKind="bill"
            trigger={
              <Button variant="outline" className="gap-2">
                <Plus className="size-4" />
                Add bill
              </Button>
            }
          />
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
      </div>

      <Suggestions detections={detections} />

      {subscriptions.some((s) => s.matcher && s.categoryId) ? (
        <div className="-mb-3 flex justify-end">
          <ApplyCategoriesButton />
        </div>
      ) : null}

      {subscriptions.length === 0 ? (
        <Card>
          <Empty
            className="p-12"
            icon={RefreshCw}
            title="No subscriptions or bills yet"
            description="Add one manually, or track a detected charge above."
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
        <>
          {[
            {
              title: 'Subscriptions',
              list: groups.subscriptions,
              empty: 'No subscriptions are billing right now.',
            },
            {
              title: 'Bills',
              list: groups.bills,
              empty: 'No bills yet. Add power, water or insurance to see them here.',
            },
          ].map(({ title, list, empty }) => (
            <section key={title} className="flex flex-col gap-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-semibold text-lg">{title}</h2>
                {list.length > 0 ? (
                  <p className="text-muted-foreground text-sm">
                    <span className="font-medium text-foreground tabular-nums">
                      {formatMoney(monthlyTotal(list), defaultCurrency)}
                    </span>{' '}
                    a month
                  </p>
                ) : null}
              </div>
              {list.length > 0 ? (
                <div className="grid gap-2">{list.map(renderCard)}</div>
              ) : (
                <p className="text-muted-foreground text-sm">{empty}</p>
              )}
            </section>
          ))}

          {groups.paused.length > 0 ? (
            <section className="flex flex-col gap-3">
              <div>
                <h2 className="font-semibold text-lg">Paused</h2>
                <p className="text-muted-foreground text-sm">Not counted in the monthly totals.</p>
              </div>
              <div className="grid gap-2">{groups.paused.map(renderCard)}</div>
            </section>
          ) : null}

          {groups.cancelled.length > 0 ? (
            <section className="flex flex-col gap-3">
              <div>
                <h2 className="font-semibold text-lg">Cancelled</h2>
                <p className="text-muted-foreground text-sm">Kept for their history.</p>
              </div>
              <div className="grid gap-2">{groups.cancelled.map(renderCard)}</div>
            </section>
          ) : null}
        </>
      )}
    </div>
  )
}
