'use client'

import { Button, Card, CardContent } from '@repo/ui'
import { Check, Sparkles } from 'lucide-react'
import { useState, useTransition } from 'react'
import { formatMoney } from '@/lib/money'
import { hiddenSummary } from '../_lib/detection'
import { CYCLE_LABELS } from '../_lib/schedule'
import { applySuggestion, dismissSuggestion, type SubscriptionDetections } from '../actions'

export function Suggestions({ detections }: { detections: SubscriptionDetections }) {
  // Hidden straight away on click; the server keeps the answer for next time.
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [pendingKey, setPendingKey] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const visible = detections.suggestions.filter((s) => !dismissed.has(s.matcher))
  const hiddenLine = hiddenSummary(detections.hidden)
  if (visible.length === 0) {
    return hiddenLine ? <p className="text-muted-foreground text-xs">{hiddenLine}</p> : null
  }

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
                  disabled={pendingKey === s.matcher}
                  onClick={() => {
                    setDismissed((d) => new Set(d).add(s.matcher))
                    startTransition(async () => {
                      await dismissSuggestion(s.matcher)
                    })
                  }}
                >
                  Not a subscription
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
                  {pendingKey === s.matcher ? 'Adding…' : 'Track'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {hiddenLine ? <p className="text-muted-foreground text-xs">{hiddenLine}</p> : null}
    </section>
  )
}
