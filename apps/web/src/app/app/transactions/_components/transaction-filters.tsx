'use client'

import type { Category } from '@repo/database'
import { Button, Input, OptionSelect } from '@repo/ui'
import { Search, X } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import type { FormEvent } from 'react'
import { CategoryIcon } from '../../categories/_components/category-icon'
import { TagSwatch } from '../../tags/_components/tag-pill'

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
  /** Hide the From/To inputs when the view has a fixed date range (e.g. one FY). */
  showDateRange?: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()
  const hasFilters = Boolean(
    current.accountId ||
      current.q ||
      (showDateRange && (current.from || current.to)) ||
      current.category ||
      current.tag ||
      current.amountMin ||
      current.amountMax,
  )

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const params = new URLSearchParams()
    const account = String(data.get('accountId') ?? 'all')
    const category = String(data.get('category') ?? 'all')
    const tag = String(data.get('tag') ?? 'all')
    const q = String(data.get('q') ?? '').trim()
    const from = String(data.get('from') ?? '')
    const to = String(data.get('to') ?? '')
    const min = String(data.get('min') ?? '').trim()
    const max = String(data.get('max') ?? '').trim()
    if (accounts && account && account !== 'all') params.set('account', account)
    if (category && category !== 'all') params.set('category', category)
    if (tags && tag && tag !== 'all') params.set('tag', tag)
    if (q) params.set('q', q)
    if (showDateRange && from) params.set('from', from)
    if (showDateRange && to) params.set('to', to)
    if (min) params.set('min', min)
    if (max) params.set('max', max)
    // New filter set → back to page 1 (omit page param).
    router.push(params.toString() ? `${pathname}?${params}` : pathname)
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-wrap items-end gap-3 rounded-lg border bg-card/40 p-3"
    >
      {accounts ? (
        <div className="grid gap-1.5">
          <label className="text-muted-foreground text-xs" htmlFor="filter-account">
            Account
          </label>
          <OptionSelect
            id="filter-account"
            name="accountId"
            className="w-52"
            defaultValue={current.accountId ?? 'all'}
            options={[
              { value: 'all', label: 'All accounts' },
              ...accounts.map((a) => ({ value: a.id, label: a.label })),
            ]}
          />
        </div>
      ) : null}

      <div className="grid gap-1.5">
        <label className="text-muted-foreground text-xs" htmlFor="filter-category">
          Category
        </label>
        <OptionSelect
          id="filter-category"
          name="category"
          className="w-48"
          defaultValue={current.category ?? 'all'}
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
      </div>

      {tags ? (
        <div className="grid gap-1.5">
          <label className="text-muted-foreground text-xs" htmlFor="filter-tag">
            Tag
          </label>
          <OptionSelect
            id="filter-tag"
            name="tag"
            className="w-44"
            defaultValue={current.tag ?? 'all'}
            options={[
              { value: 'all', label: 'All tags' },
              ...tags.map((t) => ({ value: t.id, label: <TagSwatch tag={t} /> })),
            ]}
          />
        </div>
      ) : null}

      <div className="grid flex-1 gap-1.5">
        <label className="text-muted-foreground text-xs" htmlFor="filter-q">
          Search
        </label>
        <Input
          id="filter-q"
          name="q"
          defaultValue={current.q ?? ''}
          placeholder="Description, payee, merchant…"
          className="min-w-44"
        />
      </div>

      <div className="grid gap-1.5">
        <label className="text-muted-foreground text-xs" htmlFor="filter-min">
          Min amount
        </label>
        <Input
          id="filter-min"
          name="min"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          defaultValue={current.amountMin ?? ''}
          placeholder="0.00"
          className="w-28"
        />
      </div>

      <div className="grid gap-1.5">
        <label className="text-muted-foreground text-xs" htmlFor="filter-max">
          Max amount
        </label>
        <Input
          id="filter-max"
          name="max"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          defaultValue={current.amountMax ?? ''}
          placeholder="Any"
          className="w-28"
        />
      </div>

      {showDateRange ? (
        <>
          <div className="grid gap-1.5">
            <label className="text-muted-foreground text-xs" htmlFor="filter-from">
              From
            </label>
            <Input id="filter-from" type="date" name="from" defaultValue={current.from ?? ''} />
          </div>

          <div className="grid gap-1.5">
            <label className="text-muted-foreground text-xs" htmlFor="filter-to">
              To
            </label>
            <Input id="filter-to" type="date" name="to" defaultValue={current.to ?? ''} />
          </div>
        </>
      ) : null}

      <div className="flex gap-2">
        <Button type="submit" className="gap-2">
          <Search className="size-4" />
          Filter
        </Button>
        {hasFilters ? (
          <Button
            type="button"
            variant="ghost"
            className="gap-2"
            onClick={() => router.push(pathname)}
          >
            <X className="size-4" />
            Clear
          </Button>
        ) : null}
      </div>
    </form>
  )
}
