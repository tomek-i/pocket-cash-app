import { Badge, Button, Card, CardContent } from '@repo/ui'
import { Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { formatMoney } from '@/lib/money'
import { Empty } from '../_components/empty'
import { ConfirmDeleteDialog } from '../banks/[bankId]/_components/confirm-delete-dialog'
import { listCategories } from '../categories/actions'
import { getDefaultCurrency } from '../settings/actions'
import { CYCLE_LABELS, SubscriptionDialog } from './_components/subscription-dialog'
import { Suggestions } from './_components/suggestions'
import { deleteSubscription, listSubscriptions, suggestSubscriptions } from './actions'

export const metadata = { title: 'Subscriptions' }

export default async function SubscriptionsPage() {
  const [subscriptions, categories, suggestions, defaultCurrency] = await Promise.all([
    listSubscriptions(),
    listCategories(),
    suggestSubscriptions(),
    getDefaultCurrency(),
  ])

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

      <Suggestions suggestions={suggestions} />

      {subscriptions.length === 0 ? (
        <Card>
          <Empty
            className="p-12"
            icon={RefreshCw}
            title="No subscriptions yet"
            description="Add one manually, or apply a detected subscription above."
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
        <div className="grid gap-2">
          {subscriptions.map((sub) => (
            <Card key={sub.id}>
              <CardContent className="flex items-center justify-between gap-3 p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                    <RefreshCw className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-sm">{sub.name}</p>
                    <p className="truncate text-muted-foreground text-xs">
                      {CYCLE_LABELS[sub.cycle]}
                      {sub.nextPaymentDate ? ` · next ${sub.nextPaymentDate}` : ''}
                      {sub.category ? ` · ${sub.category.name}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant="secondary" className="tabular-nums">
                    {formatMoney(sub.amount, sub.currency)}
                  </Badge>
                  <SubscriptionDialog
                    categories={categories}
                    subscription={sub}
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
          ))}
        </div>
      )}
    </div>
  )
}
