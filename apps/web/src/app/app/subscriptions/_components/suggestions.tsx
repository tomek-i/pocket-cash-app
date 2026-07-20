'use client'

import { Button, Card, CardContent } from '@repo/ui'
import { Check, Sparkles } from 'lucide-react'
import { useState, useTransition } from 'react'
import { formatMoney } from '@/lib/money'
import { applySuggestion, type SubscriptionSuggestion } from '../actions'
import { CYCLE_LABELS } from './subscription-dialog'

export function Suggestions({ suggestions }: { suggestions: SubscriptionSuggestion[] }) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [pendingKey, setPendingKey] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const visible = suggestions.filter((s) => !dismissed.has(s.matcher))
  if (visible.length === 0) return null

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Sparkles className="size-4 text-primary" />
        <h2 className="font-semibold text-lg">Detected subscriptions</h2>
        <span className="text-muted-foreground text-sm">
          Recurring charges found in your transactions.
        </span>
      </div>
      <div className="grid gap-2">
        {visible.map((s) => (
          <Card key={s.matcher} className="border-dashed">
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="truncate font-medium text-sm">{s.name}</p>
                <p className="truncate text-muted-foreground text-xs">
                  {formatMoney(s.amount, s.currency)} · {CYCLE_LABELS[s.cycle]} · {s.occurrences}{' '}
                  charges · next {s.nextPaymentDate}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDismissed((d) => new Set(d).add(s.matcher))}
                >
                  Dismiss
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5"
                  disabled={pendingKey === s.matcher}
                  onClick={() => {
                    setPendingKey(s.matcher)
                    startTransition(async () => {
                      await applySuggestion(s)
                      setPendingKey(null)
                    })
                  }}
                >
                  <Check className="size-4" />
                  {pendingKey === s.matcher ? 'Adding…' : 'Apply'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}
