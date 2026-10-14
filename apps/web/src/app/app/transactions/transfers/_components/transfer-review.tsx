'use client'

import { Button, Card, CardContent } from '@repo/ui'
import { ArrowRight, CheckCheck } from 'lucide-react'
import Link from 'next/link'
import { useState, useTransition } from 'react'
import { formatMoney } from '@/lib/money'
import { Empty } from '../../../_components/empty'
import type { TransferSuggestion } from '../../_lib/transfer-matching'
import {
  confirmTransferPairs,
  dismissTransferPair,
  markAsTransfers,
  type TransferSuggestions,
} from '../../transfer-actions'

const pairKey = (p: TransferSuggestion) => `${p.out.id}:${p.in.id}`

/**
 * Review list for suggested transfers. Pairs with something beyond a matching
 * amount (transfer wording, the other account's name, the Transfers category)
 * start ticked. A plain amount match starts unticked, since it may be a
 * coincidence or a refund.
 */
export function TransferReview({ suggestions }: { suggestions: TransferSuggestions }) {
  const { pairs, oneSided } = suggestions
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(pairs.filter((p) => p.likely).map(pairKey)),
  )
  const [pending, startTransition] = useTransition()
  const [notice, setNotice] = useState<string | null>(null)

  const toggle = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  const allSelected = pairs.length > 0 && pairs.every((p) => selected.has(pairKey(p)))
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(pairs.map(pairKey)))

  const confirm = () =>
    startTransition(async () => {
      setNotice(null)
      const chosen = pairs
        .filter((p) => selected.has(pairKey(p)))
        .map((p) => ({ outId: p.out.id, inId: p.in.id }))
      const res = await confirmTransferPairs(chosen)
      if ('error' in res) setNotice(res.error)
      else setNotice(`Linked ${res.linked} transfer${res.linked === 1 ? '' : 's'}.`)
      setSelected(new Set())
    })

  const dismiss = (p: TransferSuggestion) =>
    startTransition(async () => {
      setNotice(null)
      await dismissTransferPair(p.out.id, p.in.id)
    })

  const markOneSided = () =>
    startTransition(async () => {
      setNotice(null)
      const res = await markAsTransfers(oneSided.map((r) => r.id))
      if ('error' in res) setNotice(res.error)
      else setNotice(`Marked ${oneSided.length} as transfers.`)
    })

  if (pairs.length === 0 && oneSided.length === 0) {
    return (
      <Card>
        <Empty
          className="p-12"
          icon={CheckCheck}
          title="No possible transfers"
          description="Nothing in your accounts looks like an unconfirmed transfer. New ones show up here after an import."
        />
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {notice ? <p className="text-muted-foreground text-sm">{notice}</p> : null}

      {pairs.length > 0 ? (
        <Card>
          <CardContent className="flex flex-col gap-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 p-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={allSelected}
                  onChange={toggleAll}
                />
                <span className="font-medium">
                  {selected.size} of {pairs.length} selected
                </span>
              </label>
              <Button
                size="sm"
                className="h-8"
                disabled={selected.size === 0 || pending}
                onClick={confirm}
              >
                {pending ? 'Working…' : `Link ${selected.size} as transfers`}
              </Button>
            </div>

            <ul className="flex list-none flex-col divide-y p-0">
              {pairs.map((p) => {
                const key = pairKey(p)
                return (
                  <li key={key} className="flex flex-wrap items-center gap-3 py-3">
                    <input
                      type="checkbox"
                      className="size-4 shrink-0 accent-primary"
                      checked={selected.has(key)}
                      onChange={() => toggle(key)}
                      aria-label={`Select transfer from ${p.out.accountName} to ${p.in.accountName}`}
                    />
                    <Side
                      id={p.out.id}
                      name={p.out.displayName ?? p.out.description}
                      account={p.out.accountName}
                      date={p.out.date}
                    />
                    <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                    <Side
                      id={p.in.id}
                      name={p.in.displayName ?? p.in.description}
                      account={p.in.accountName}
                      date={p.in.date}
                    />
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="font-medium text-sm tabular-nums">
                        {formatMoney(p.amount, p.currency)}
                      </span>
                      {p.likely ? null : (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          Amount only
                        </span>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        onClick={() => dismiss(p)}
                      >
                        Not a transfer
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {oneSided.length > 0 ? (
        <Card>
          <CardContent className="flex flex-col gap-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-sm">In your Transfers category, not marked yet</p>
                <p className="text-muted-foreground text-sm">
                  No matching side was found in your other accounts, so these would count as
                  one-sided transfers.
                </p>
              </div>
              <Button variant="outline" size="sm" disabled={pending} onClick={markOneSided}>
                Mark all {oneSided.length} as transfers
              </Button>
            </div>
            <ul className="flex list-none flex-col divide-y p-0">
              {oneSided.slice(0, 50).map((r) => (
                <li key={r.id} className="flex items-center gap-3 py-2.5">
                  <Side
                    id={r.id}
                    name={r.displayName ?? r.description}
                    account={r.accountName}
                    date={r.date}
                  />
                  <span className="shrink-0 font-medium text-sm tabular-nums">
                    {formatMoney(r.amount, r.currency)}
                  </span>
                </li>
              ))}
            </ul>
            {oneSided.length > 50 ? (
              <p className="text-muted-foreground text-xs">And {oneSided.length - 50} more.</p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

function Side({
  id,
  name,
  account,
  date,
}: {
  id: string
  name: string
  account: string
  date: string
}) {
  return (
    <div className="min-w-0 flex-1 basis-48">
      <Link
        href={`/app/transactions/${id}`}
        className="block truncate font-medium text-sm hover:underline"
      >
        {name}
      </Link>
      <p className="truncate text-muted-foreground text-xs">
        {account} · {date}
      </p>
    </div>
  )
}
