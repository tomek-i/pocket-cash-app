'use client'

import { Button, Card, CardContent } from '@repo/ui'
import { ArrowLeftRight, Link2, Unlink } from 'lucide-react'
import Link from 'next/link'
import { useState, useTransition } from 'react'
import { amountClassName, formatMoney } from '@/lib/money'
import type { TransactionDetail } from '../../actions'
import {
  linkTransfer,
  setTransfer,
  type TransferCandidate,
  unlinkTransfer,
} from '../../transfer-actions'

/**
 * Mark a transaction as a transfer between the user's own accounts, and link it
 * to its other side when that account is tracked too.
 */
export function TransferPanel({
  transactionId,
  isTransfer,
  pair,
  candidates,
}: {
  transactionId: string
  isTransfer: boolean
  pair: TransactionDetail['transferPair']
  /** Unlinked transactions in other accounts that cancel this one out. */
  candidates: TransferCandidate[]
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const run = (fn: () => Promise<{ ok: true } | { error: string }>) =>
    startTransition(async () => {
      setError(null)
      const res = await fn()
      if ('error' in res) setError(res.error)
    })

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <ArrowLeftRight className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-sm">
                {isTransfer ? 'Transfer between your accounts' : 'Not a transfer'}
              </p>
              <p className="text-muted-foreground text-sm">
                {isTransfer
                  ? 'Counts towards the account balance, but not as income or spending.'
                  : 'Mark it as a transfer if this is your own money moving between accounts.'}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => run(() => setTransfer(transactionId, !isTransfer))}
          >
            {isTransfer ? 'Not a transfer' : 'Mark as transfer'}
          </Button>
        </div>

        {pair ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
            <div className="min-w-0 text-sm">
              <p className="text-muted-foreground text-xs">Other side</p>
              <Link href={`/app/transactions/${pair.id}`} className="text-primary hover:underline">
                {pair.accountName} · {pair.date}
              </Link>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5"
              disabled={pending}
              onClick={() => run(() => unlinkTransfer(transactionId))}
            >
              <Unlink className="size-4" />
              Unlink
            </Button>
          </div>
        ) : candidates.length > 0 ? (
          <div className="flex flex-col gap-2">
            <p className="text-muted-foreground text-xs">
              {isTransfer
                ? 'Is one of these the other side? Linking it marks both as a transfer.'
                : 'These cancel this one out. Linking one marks both as a transfer.'}
            </p>
            <ul className="flex list-none flex-col divide-y rounded-lg border p-0">
              {candidates.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-sm">{c.displayName ?? c.description}</p>
                    <p className="truncate text-muted-foreground text-xs">
                      {c.accountName} · {c.date}
                    </p>
                  </div>
                  <span className={`text-sm tabular-nums ${amountClassName(c.amount)}`}>
                    {formatMoney(c.amount, c.currency)}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    disabled={pending}
                    onClick={() => run(() => linkTransfer(transactionId, c.id))}
                  >
                    <Link2 className="size-4" />
                    Link
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ) : isTransfer ? (
          <p className="text-muted-foreground text-xs">
            No matching transaction in your other accounts. If the other account is not tracked
            here, this stays a one-sided transfer.
          </p>
        ) : null}

        {error ? <p className="text-destructive text-xs">{error}</p> : null}
      </CardContent>
    </Card>
  )
}
