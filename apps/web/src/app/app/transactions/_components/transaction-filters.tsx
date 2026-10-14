'use client'

import type { Category } from '@repo/database'
import { Button, Input, OptionSelect } from '@repo/ui'
import { CalendarDays, Search, SlidersHorizontal, X } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { type KeyboardEvent, useEffect, useRef, useState } from 'react'
import { useDateFormat } from '../../_components/date-format-provider'
import { CategoryIcon } from '../../categories/_components/category-icon'
import { TagSwatch } from '../../tags/_components/tag-pill'
import { DATE_PRESET_LABELS, type DatePreset, presetFor, presetRange } from '../_lib/date-presets'

export interface FilterAccount {
  id: string
  label: string
}

export interface FilterTag {
  id: string
  name: string
  /** Carried so the filter shows a tag the way the list does. */
  color: string | null
}

type CategoryLite = Pick<Category, 'id' | 'name' | 'color' | 'icon'>

export interface FilterValues {
  accountId?: string
  q?: string
  from?: string
  to?: string
  category?: string
  tag?: string
  /** Amount range, as the raw dollar strings the user typed (major units). */
  amountMin?: string
  amountMax?: string
}

/** URL parameter for each filter. */
type Param = 'account' | 'q' | 'from' | 'to' | 'category' | 'tag' | 'min' | 'max'

/** How long typing in the search box waits before it filters. */
const SEARCH_DELAY_MS = 350

/**
 * The filter bar above a transactions table. Every change applies straight away
 * by rewriting the URL (and dropping back to page one). Active filters show as
 * chips that remove themselves, with "Clear all".
 */
export function TransactionFilters({
  accounts,
  categories,
  tags,
  current,
  showDateRange = true,
}: {
  /** Omit to hide the account select (e.g. a view already scoped to accounts). */
  accounts?: FilterAccount[]
  categories: CategoryLite[]
  /** Pass to show a tag select; omit to hide it. */
  tags?: FilterTag[]
  current: FilterValues
  /** Hide the date choices when the view has a fixed date range (e.g. one FY). */
  showDateRange?: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { date: formatDate } = useDateFormat()

  const [q, setQ] = useState(current.q ?? '')
  const [min, setMin] = useState(current.amountMin ?? '')
  const [max, setMax] = useState(current.amountMax ?? '')
  const [showAmount, setShowAmount] = useState(Boolean(current.amountMin || current.amountMax))
  const activePreset = presetFor(current.from, current.to)
  const [preset, setPreset] = useState<DatePreset>(activePreset)

  // Follow the URL when it changes from elsewhere (a chip, Clear all, back).
  useEffect(() => setQ(current.q ?? ''), [current.q])
  useEffect(() => setMin(current.amountMin ?? ''), [current.amountMin])
  useEffect(() => setMax(current.amountMax ?? ''), [current.amountMax])
  useEffect(() => setPreset(activePreset), [activePreset])

  /** Rewrite the URL with these filters changed. Page size is kept; the page resets. */
  const apply = (patch: Partial<Record<Param, string | undefined>>) => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('page')
    for (const [key, value] of Object.entries(patch)) {
      if (value) params.set(key, value)
      else params.delete(key)
    }
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  // Search applies after a short pause in typing.
  const applyRef = useRef(apply)
  applyRef.current = apply
  useEffect(() => {
    const trimmed = q.trim()
    if (trimmed === (current.q ?? '')) return
    const timer = setTimeout(() => applyRef.current({ q: trimmed || undefined }), SEARCH_DELAY_MS)
    return () => clearTimeout(timer)
  }, [q, current.q])

  const applyAmount = () => {
    const nextMin = min.trim()
    const nextMax = max.trim()
    if (nextMin === (current.amountMin ?? '') && nextMax === (current.amountMax ?? '')) return
    apply({ min: nextMin || undefined, max: nextMax || undefined })
  }
  const onAmountKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') applyAmount()
  }

  const choosePreset = (value: string) => {
    const next = value as DatePreset
    setPreset(next)
    if (next === 'custom') return
    const range = presetRange(next)
    apply({ from: range?.from, to: range?.to })
  }

  // ── Active filters as chips ────────────────────────────────────────────────
  const chips: { key: string; label: string; clear: Partial<Record<Param, undefined>> }[] = []
  if (current.q) chips.push({ key: 'q', label: `“${current.q}”`, clear: { q: undefined } })
  if (accounts && current.accountId) {
    const account = accounts.find((a) => a.id === current.accountId)
    chips.push({
      key: 'account',
      label: account?.label ?? 'Account',
      clear: { account: undefined },
    })
  }
  if (current.category) {
    const name =
      current.category === 'uncategorised'
        ? 'Uncategorised'
        : (categories.find((c) => c.id === current.category)?.name ?? 'Category')
    chips.push({ key: 'category', label: name, clear: { category: undefined } })
  }
  if (tags && current.tag) {
    const tag = tags.find((t) => t.id === current.tag)
    chips.push({ key: 'tag', label: `Tag: ${tag?.name ?? '?'}`, clear: { tag: undefined } })
  }
  if (showDateRange && (current.from || current.to)) {
    const label =
      activePreset === 'custom'
        ? `${current.from ? formatDate(current.from) : '…'} to ${current.to ? formatDate(current.to) : '…'}`
        : DATE_PRESET_LABELS[activePreset]
    chips.push({ key: 'date', label, clear: { from: undefined, to: undefined } })
  }
  if (current.amountMin || current.amountMax) {
    const label =
      current.amountMin && current.amountMax
        ? `$${current.amountMin} to $${current.amountMax}`
        : current.amountMin
          ? `At least $${current.amountMin}`
          : `Up to $${current.amountMax}`
    chips.push({ key: 'amount', label, clear: { min: undefined, max: undefined } })
  }

  const clearAll = () => {
    const keep = new URLSearchParams()
    const size = searchParams.get('size')
    if (size) keep.set('size', size)
    const qs = keep.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-card/40 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search description, payee, merchant…"
            className="pl-9"
            aria-label="Search transactions"
            type="search"
          />
        </div>

        {accounts ? (
          <OptionSelect
            ariaLabel="Account"
            className="w-48"
            value={current.accountId ?? 'all'}
            onValueChange={(v) => apply({ account: v === 'all' ? undefined : v })}
            options={[
              { value: 'all', label: 'All accounts' },
              ...accounts.map((a) => ({ value: a.id, label: a.label })),
            ]}
          />
        ) : null}

        <OptionSelect
          ariaLabel="Category"
          className="w-44"
          value={current.category ?? 'all'}
          onValueChange={(v) => apply({ category: v === 'all' ? undefined : v })}
          options={[
            { value: 'all', label: 'All categories' },
            { value: 'uncategorised', label: 'Uncategorised' },
            ...categories.map((c) => ({
              value: c.id,
              label: (
                <span className="flex items-center gap-2">
                  <CategoryIcon name={c.icon} color={c.color} className="size-4" />
                  {c.name}
                </span>
              ),
            })),
          ]}
        />

        {tags ? (
          <OptionSelect
            ariaLabel="Tag"
            className="w-40"
            value={current.tag ?? 'all'}
            onValueChange={(v) => apply({ tag: v === 'all' ? undefined : v })}
            options={[
              { value: 'all', label: 'All tags' },
              ...tags.map((t) => ({ value: t.id, label: <TagSwatch tag={t} /> })),
            ]}
          />
        ) : null}

        {showDateRange ? (
          <OptionSelect
            ariaLabel="Date"
            className="w-44"
            value={preset}
            onValueChange={choosePreset}
            options={(Object.keys(DATE_PRESET_LABELS) as DatePreset[]).map((p) => ({
              value: p,
              label: (
                <span className="flex items-center gap-2">
                  <CalendarDays className="size-4 text-muted-foreground" />
                  {DATE_PRESET_LABELS[p]}
                </span>
              ),
            }))}
          />
        ) : null}

        <Button
          type="button"
          variant={showAmount ? 'secondary' : 'ghost'}
          className="gap-2"
          aria-expanded={showAmount}
          onClick={() => setShowAmount((v) => !v)}
        >
          <SlidersHorizontal className="size-4" />
          Amount
        </Button>
      </div>

      {(showDateRange && preset === 'custom') || showAmount ? (
        <div className="flex flex-wrap items-center gap-4">
          {showDateRange && preset === 'custom' ? (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">From</span>
              <Input
                type="date"
                aria-label="From date"
                className="w-40"
                value={current.from ?? ''}
                onChange={(e) => apply({ from: e.target.value || undefined })}
              />
              <span className="text-muted-foreground">to</span>
              <Input
                type="date"
                aria-label="To date"
                className="w-40"
                value={current.to ?? ''}
                onChange={(e) => apply({ to: e.target.value || undefined })}
              />
            </div>
          ) : null}
          {showAmount ? (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Amount</span>
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                aria-label="Minimum amount"
                placeholder="Min"
                className="w-28"
                value={min}
                onChange={(e) => setMin(e.target.value)}
                onBlur={applyAmount}
                onKeyDown={onAmountKey}
              />
              <span className="text-muted-foreground">to</span>
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                aria-label="Maximum amount"
                placeholder="Max"
                className="w-28"
                value={max}
                onChange={(e) => setMax(e.target.value)}
                onBlur={applyAmount}
                onKeyDown={onAmountKey}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {chips.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => apply(chip.clear)}
              className="flex items-center gap-1 rounded-full border bg-background px-2.5 py-0.5 text-xs hover:bg-muted"
              aria-label={`Remove filter ${chip.label}`}
            >
              {chip.label}
              <X className="size-3 text-muted-foreground" />
            </button>
          ))}
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={clearAll}>
            Clear all
          </Button>
        </div>
      ) : null}
    </div>
  )
}

/** The count and money in/out line shown above a filtered list. */
export function TotalsLine({
  count,
  moneyIn,
  moneyOut,
}: {
  count: number
  /** Formatted money in, or empty to leave it out. */
  moneyIn: string
  /** Formatted money out, or empty to leave it out. */
  moneyOut: string
}) {
  return (
    <p className="text-muted-foreground text-sm">
      <span className="font-medium text-foreground">
        {count} transaction{count === 1 ? '' : 's'}
      </span>
      {moneyIn ? (
        <>
          {' · '}In <span className="font-medium text-success tabular-nums">{moneyIn}</span>
        </>
      ) : null}
      {moneyOut ? (
        <>
          {' · '}Out <span className="font-medium text-foreground tabular-nums">{moneyOut}</span>
        </>
      ) : null}
    </p>
  )
}
