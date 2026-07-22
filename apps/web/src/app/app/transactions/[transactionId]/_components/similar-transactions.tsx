'use client'

import type { Category, Tag } from '@repo/database'
import {
  Button,
  Card,
  CardContent,
  cn,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState, useTransition } from 'react'
import { amountClassName, formatMoney } from '@/lib/money'
import { CategoryIcon } from '../../../categories/_components/category-icon'
import {
  bulkUpdateTransactions,
  findSimilarTransactions,
  type SimilarTransaction,
} from '../../actions'

type CategoryLite = Pick<Category, 'id' | 'name' | 'color' | 'icon'>
type TagLite = Pick<Tag, 'id' | 'name' | 'color'>

const PAGE_SIZE = 10

export function SimilarTransactions({
  transactionId,
  categories,
  tags,
}: {
  transactionId: string
  categories: CategoryLite[]
  tags: TagLite[]
}) {
  const [threshold, setThreshold] = useState(0.3)
  const [includeAmount, setIncludeAmount] = useState(false)
  const [results, setResults] = useState<SimilarTransaction[]>([])
  const [loaded, setLoaded] = useState(false)
  const [searching, startSearch] = useTransition()

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [page, setPage] = useState(0)

  const [nameEnabled, setNameEnabled] = useState(false)
  const [nameValue, setNameValue] = useState('')
  const [category, setCategory] = useState('nochange') // 'nochange' | 'none' | <id>
  const [addTags, setAddTags] = useState<Set<string>>(new Set())
  const [applying, startApply] = useTransition()
  const [notice, setNotice] = useState<string | null>(null)

  // Debounced re-search when the query changes. Inlined so the effect depends
  // only on the query inputs (setters and the imported action are stable).
  useEffect(() => {
    const timer = setTimeout(() => {
      startSearch(async () => {
        const res = await findSimilarTransactions({ id: transactionId, threshold, includeAmount })
        setResults(res)
        setLoaded(true)
        setPage(0)
        setSelected(new Set())
      })
    }, 250)
    return () => clearTimeout(timer)
  }, [transactionId, threshold, includeAmount])

  const totalPages = Math.max(1, Math.ceil(results.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages - 1)
  const pageItems = results.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE)
  const allSelected = results.length > 0 && selected.size === results.length

  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(results.map((r) => r.id)))
  const toggleTag = (id: string) =>
    setAddTags((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const hasChanges = nameEnabled || category !== 'nochange' || addTags.size > 0
  const canApply = selected.size > 0 && hasChanges && !applying

  const apply = () =>
    startApply(async () => {
      setNotice(null)
      const res = await bulkUpdateTransactions({
        ids: [...selected],
        setDisplayName: nameEnabled ? nameValue : undefined,
        setCategoryId: category === 'nochange' ? undefined : category === 'none' ? null : category,
        addTagIds: addTags.size ? [...addTags] : undefined,
      })
      if ('error' in res) {
        setNotice(res.error)
        return
      }
      setNotice(`Updated ${selected.size} transaction(s).`)
      setNameEnabled(false)
      setNameValue('')
      setCategory('nochange')
      setAddTags(new Set())
      const refreshed = await findSimilarTransactions({
        id: transactionId,
        threshold,
        includeAmount,
      })
      setResults(refreshed)
      setPage(0)
      setSelected(new Set())
    })

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="font-semibold text-lg">Similar transactions</h2>
        <p className="text-muted-foreground text-sm">
          Fuzzy match on the description (trailing reference codes ignored). Select rows to
          bulk-apply a display name, category or tags.
        </p>
      </div>
      <Card>
        <CardContent className="flex flex-col gap-4 p-5">
          {/* Search controls */}
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
            <div className="flex min-w-56 flex-1 flex-col gap-1.5">
              <label htmlFor="sim-threshold" className="text-muted-foreground text-xs">
                Minimum similarity · {Math.round(threshold * 100)}%
              </label>
              <input
                id="sim-threshold"
                type="range"
                min={5}
                max={95}
                step={5}
                value={Math.round(threshold * 100)}
                onChange={(e) => setThreshold(Number(e.target.value) / 100)}
                className="w-full accent-primary"
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={includeAmount}
                onChange={(e) => setIncludeAmount(e.target.checked)}
              />
              Same amount only
            </label>
          </div>

          {!loaded ? (
            <p className="text-muted-foreground text-sm">Searching…</p>
          ) : results.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No similar transactions at this threshold{includeAmount ? ' and amount' : ''}.
            </p>
          ) : (
            <>
              {/* Bulk toolbar */}
              <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={allSelected}
                      onChange={toggleAll}
                    />
                    <span className="font-medium">
                      {selected.size} of {results.length} selected
                    </span>
                  </label>
                  {selected.size > 0 ? (
                    <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                      Clear selection
                    </Button>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={nameEnabled}
                      onChange={(e) => setNameEnabled(e.target.checked)}
                    />
                    Name
                  </label>
                  <Input
                    value={nameValue}
                    disabled={!nameEnabled}
                    placeholder="New display name"
                    className="h-8 w-48"
                    onChange={(e) => setNameValue(e.target.value)}
                  />

                  <Select value={category} onValueChange={(v) => setCategory(v ?? 'nochange')}>
                    <SelectTrigger className="h-8 w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nochange">Category: no change</SelectItem>
                      <SelectItem value="none">Uncategorise</SelectItem>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          <span className="flex items-center gap-2">
                            <CategoryIcon name={c.icon} color={c.color} className="size-4" />
                            {c.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <DropdownMenu>
                    <DropdownMenuTrigger
                      nativeButton={false}
                      render={
                        <Button variant="outline" size="sm" className="h-8">
                          Add tags{addTags.size ? ` (${addTags.size})` : ''}
                        </Button>
                      }
                    />
                    <DropdownMenuContent align="start" className="max-h-72 w-48 overflow-auto">
                      <DropdownMenuGroup>
                        <DropdownMenuLabel>Tags to add</DropdownMenuLabel>
                        {tags.length === 0 ? (
                          <p className="px-2 py-1.5 text-muted-foreground text-sm">No tags yet</p>
                        ) : (
                          tags.map((t) => (
                            <DropdownMenuCheckboxItem
                              key={t.id}
                              checked={addTags.has(t.id)}
                              closeOnClick={false}
                              onCheckedChange={() => toggleTag(t.id)}
                            >
                              {t.name}
                            </DropdownMenuCheckboxItem>
                          ))
                        )}
                      </DropdownMenuGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <Button size="sm" className="h-8" disabled={!canApply} onClick={apply}>
                    {applying ? 'Applying…' : `Apply to ${selected.size}`}
                  </Button>
                </div>
                {notice ? <p className="text-muted-foreground text-xs">{notice}</p> : null}
              </div>

              {/* Results (paginated) */}
              <div className={cn('flex flex-col', searching && 'opacity-60')}>
                {pageItems.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/40"
                  >
                    <input
                      type="checkbox"
                      className="size-4 shrink-0 accent-primary"
                      checked={selected.has(r.id)}
                      onChange={() => toggleOne(r.id)}
                      aria-label={`Select ${r.displayName ?? r.description}`}
                    />
                    <Link href={`/app/transactions/${r.id}`} className="min-w-0 flex-1">
                      <p className="truncate font-medium text-sm hover:underline">
                        {r.displayName ?? r.description}
                      </p>
                      <p className="truncate text-muted-foreground text-xs">
                        {r.date} · {Math.round(r.similarity * 100)}% match
                      </p>
                    </Link>
                    <span
                      className={cn(
                        'shrink-0 text-right text-sm tabular-nums',
                        amountClassName(r.amount),
                      )}
                    >
                      {formatMoney(r.amount, r.currency)}
                    </span>
                  </div>
                ))}
              </div>

              {totalPages > 1 ? (
                <div className="flex items-center justify-between text-muted-foreground text-sm">
                  <span>
                    Page {currentPage + 1} / {totalPages}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      disabled={currentPage <= 0}
                      onClick={() => setPage(currentPage - 1)}
                    >
                      <ChevronLeft className="size-4" />
                      Prev
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      disabled={currentPage >= totalPages - 1}
                      onClick={() => setPage(currentPage + 1)}
                    >
                      Next
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
