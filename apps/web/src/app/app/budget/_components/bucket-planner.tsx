'use client'

import {
  BUCKET_DEFINITIONS,
  type BucketShare,
  type BudgetBucketType,
  bucketCaps,
  kindShare,
  rebalance,
} from '@repo/budget'
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@repo/ui'
import { Pencil, Plus, X } from 'lucide-react'
import { useEffect, useRef, useState, useTransition } from 'react'
import { formatMoney } from '@/lib/money'
import {
  addBudgetBucket,
  type BudgetBucketView,
  type BudgetCategory,
  removeBudgetBucket,
  saveBudgetShares,
} from '../actions'
import { BUCKET_COLOURS, formatShare } from './bucket-colours'
import { BucketRenameDialog } from './bucket-rename-dialog'
import { CategoryAssignmentDialog } from './category-assignment-dialog'

/** How long the dials sit still before the split is saved. */
const SAVE_DELAY_MS = 400

/**
 * The dials. Dragging one bucket rebalances the others on the spot, and the
 * split is saved once the dials sit still. The parent remounts this with a new
 * key whenever the saved split changes elsewhere (a preset, an added bucket).
 */
export function BucketPlanner({
  buckets,
  availableTypes,
  categories,
  totalIncome,
  currency,
}: {
  buckets: BudgetBucketView[]
  availableTypes: BudgetBucketType[]
  categories: BudgetCategory[]
  totalIncome: number
  currency: string
}) {
  const [shares, setShares] = useState<BucketShare[]>(() =>
    buckets.map(({ type, share }) => ({ type, share })),
  )
  const [, startTransition] = useTransition()
  const [changing, startChange] = useTransition()
  const saved = useRef(shares)

  useEffect(() => {
    if (shares === saved.current) return
    const timer = setTimeout(() => {
      saved.current = shares
      startTransition(() => {
        saveBudgetShares(shares)
      })
    }, SAVE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [shares])

  const caps = bucketCaps(totalIncome, shares)
  const byType = new Map(buckets.map((bucket) => [bucket.type, bucket]))

  return (
    <div className="grid gap-5">
      <div
        className="flex h-9 overflow-hidden rounded-lg border"
        role="img"
        aria-label={shares
          .map((s) => `${byType.get(s.type)?.label} ${formatShare(s.share)}`)
          .join(', ')}
      >
        {shares
          .filter((s) => s.share > 0)
          .map((s) => (
            <div
              key={s.type}
              className="flex min-w-0 items-center justify-center overflow-hidden whitespace-nowrap px-1 font-medium text-neutral-950 text-xs transition-[width]"
              style={{ width: `${s.share / 100}%`, backgroundColor: BUCKET_COLOURS[s.type] }}
            >
              {s.share >= 1800
                ? `${byType.get(s.type)?.label} ${formatShare(s.share)}`
                : s.share >= 600
                  ? formatShare(s.share)
                  : null}
            </div>
          ))}
      </div>

      <ul className="grid list-none gap-5 p-0">
        {caps.map(({ type, share, cap }) => {
          const bucket = byType.get(type)
          if (!bucket) return null
          return (
            <li key={type} className="grid gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    aria-hidden
                    className="size-3 shrink-0 rounded-full"
                    style={{ backgroundColor: BUCKET_COLOURS[type] }}
                  />
                  <span className="truncate font-medium">{bucket.label}</span>
                  <Badge variant="outline" className="text-muted-foreground">
                    {bucket.kind === 'spend' ? 'Spend' : 'Save'}
                  </Badge>
                  <BucketRenameDialog
                    bucket={bucket}
                    trigger={
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        aria-label={`Rename ${bucket.label}`}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                    }
                  />
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-12 text-right font-semibold tabular-nums">
                    {formatShare(share)}
                  </span>
                  <span className="w-28 text-right text-muted-foreground tabular-nums">
                    {formatMoney(cap, currency)}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    aria-label={`Remove ${bucket.label}`}
                    disabled={shares.length === 1 || changing}
                    onClick={() => startChange(() => removeBudgetBucket(type))}
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={share / 100}
                disabled={shares.length === 1}
                aria-label={`${bucket.label} share of income`}
                aria-valuetext={`${formatShare(share)}, ${formatMoney(cap, currency)}`}
                onChange={(event) =>
                  setShares((current) => rebalance(current, type, Number(event.target.value) * 100))
                }
                className="w-full"
                style={{ accentColor: BUCKET_COLOURS[type] }}
              />
              <p className="text-muted-foreground text-xs">
                {bucket.kind === 'save' ? "Measured as what's left over. " : null}
                {bucket.categories.length > 0
                  ? bucket.categories.map((category) => category.name).join(', ')
                  : bucket.kind === 'spend'
                    ? 'No categories yet.'
                    : 'Add categories like extra repayments or ETF purchases to count them as saved.'}
              </p>
            </li>
          )
        })}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <p className="text-muted-foreground text-sm">
          Spend{' '}
          <span className="font-medium text-foreground">
            {formatShare(kindShare(shares, 'spend'))}
          </span>
          {' · '}
          Save{' '}
          <span className="font-medium text-foreground">
            {formatShare(kindShare(shares, 'save'))}
          </span>
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <CategoryAssignmentDialog
            categories={categories}
            buckets={buckets}
            trigger={
              <Button variant="outline" size="sm">
                Assign categories
              </Button>
            }
          />
          {availableTypes.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="outline" size="sm" className="gap-1" disabled={changing}>
                    <Plus className="size-3.5" />
                    Add bucket
                  </Button>
                }
              />
              <DropdownMenuContent align="end" className="w-60">
                {availableTypes.map((type) => (
                  <DropdownMenuItem
                    key={type}
                    onClick={() => startChange(() => addBudgetBucket(type))}
                  >
                    <span
                      aria-hidden
                      className="size-2.5 rounded-full"
                      style={{ backgroundColor: BUCKET_COLOURS[type] }}
                    />
                    <span className="grid">
                      <span>{BUCKET_DEFINITIONS[type].label}</span>
                      <span className="text-muted-foreground text-xs">
                        {BUCKET_DEFINITIONS[type].description}
                      </span>
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>
    </div>
  )
}
