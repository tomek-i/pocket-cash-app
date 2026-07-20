'use client'

import {
  Button,
  Card,
  CardContent,
  cn,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui'
import { ChevronLeft, ChevronRight, Sparkles, Tags } from 'lucide-react'
import { useEffect, useState, useTransition } from 'react'
import { Empty } from '../../_components/empty'
import { CategoryIcon } from '../../categories/_components/category-icon'
import {
  applyCategorizations,
  type CategorizeGroup,
  type CategorizeResult,
  suggestCategorizations,
} from '../../transactions/categorize-actions'

const PAGE_SIZE = 25
const NO_CATEGORY = 'none'

function sourceBadge(source: CategorizeGroup['source']) {
  if (source === 'ai') return { label: 'AI', className: 'bg-primary/10 text-primary' }
  if (source === 'rule')
    return { label: 'Learned', className: 'bg-emerald-500/10 text-emerald-500' }
  return { label: '—', className: 'bg-muted text-muted-foreground' }
}

export function CategorizeReview({ aiConfigured }: { aiConfigured: boolean }) {
  const [result, setResult] = useState<CategorizeResult | null>(null)
  const [loading, startLoad] = useTransition()
  const [applying, startApply] = useTransition()
  const [notice, setNotice] = useState<string | null>(null)

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [catOverride, setCatOverride] = useState<Map<string, string>>(new Map())
  const [nameOverride, setNameOverride] = useState<Map<string, string>>(new Map())
  const [page, setPage] = useState(0)

  const load = (useAi: boolean) =>
    startLoad(async () => {
      setNotice(null)
      const res = await suggestCategorizations({ useAi })
      setResult(res)
      setPage(0)
      setCatOverride(new Map())
      setNameOverride(new Map())
      // Pre-select every group that came back with a suggested category.
      setSelected(new Set(res.groups.filter((g) => g.suggestedCategoryId).map((g) => g.key)))
    })

  // Instant, free, offline rules on first render. AI is an explicit opt-in click.
  // biome-ignore lint/correctness/useExhaustiveDependencies: run once on mount
  useEffect(() => {
    load(false)
  }, [])

  const groups = result?.groups ?? []
  const totalPages = Math.max(1, Math.ceil(groups.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages - 1)
  const pageItems = groups.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE)

  const effectiveCat = (g: CategorizeGroup) =>
    catOverride.get(g.key) ?? g.suggestedCategoryId ?? NO_CATEGORY
  const effectiveName = (g: CategorizeGroup) =>
    nameOverride.get(g.key) ?? g.suggestedDisplayName ?? ''

  const toggleOne = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  const allSelected = groups.length > 0 && selected.size === groups.length
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(groups.map((g) => g.key)))

  const setCat = (key: string, v: string) => setCatOverride((prev) => new Map(prev).set(key, v))
  const setName = (key: string, v: string) => setNameOverride((prev) => new Map(prev).set(key, v))

  // Selected groups that carry an actual change (a category and/or a name).
  const pending = groups.filter((g) => {
    if (!selected.has(g.key)) return false
    const cat = effectiveCat(g)
    return cat !== NO_CATEGORY || effectiveName(g).trim().length > 0
  })

  const apply = () =>
    startApply(async () => {
      setNotice(null)
      const entries = pending.map((g) => {
        const cat = effectiveCat(g)
        const name = effectiveName(g).trim()
        return {
          ids: g.transactionIds,
          categoryId: cat === NO_CATEGORY ? undefined : cat,
          displayName: name ? name : undefined,
        }
      })
      const res = await applyCategorizations({ entries })
      if ('error' in res) {
        setNotice(res.error)
        return
      }
      setNotice(`Categorised ${res.updated} transaction(s).`)
      load(false)
    })

  const txPending = pending.reduce((sum, g) => sum + g.count, 0)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          {result
            ? `${result.totalUncategorised} uncategorised transaction(s) across ${groups.length} merchant(s).`
            : 'Loading suggestions…'}
        </p>
        <div className="flex items-center gap-2">
          {aiConfigured ? (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={loading}
              onClick={() => load(true)}
            >
              <Sparkles className="size-4" />
              {result?.aiUsed ? 'Re-run with AI' : 'Suggest with AI'}
            </Button>
          ) : null}
          <Button size="sm" variant="ghost" disabled={loading} onClick={() => load(false)}>
            Refresh
          </Button>
        </div>
      </div>

      {result?.aiError ? (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-destructive text-xs">
          AI suggestions failed: {result.aiError}
        </p>
      ) : null}
      {result?.truncated ? (
        <p className="rounded-md bg-muted px-3 py-2 text-muted-foreground text-xs">
          Only the first 200 unlearned merchants were sent to the AI this run — refresh after
          applying to process the rest.
        </p>
      ) : null}

      {loading && !result ? (
        <p className="text-muted-foreground text-sm">Working…</p>
      ) : groups.length === 0 ? (
        <Empty
          icon={Tags}
          title="Nothing to categorise"
          description="Every transaction already has a category. Import more or check back later."
        />
      ) : (
        <Card>
          <CardContent className="flex flex-col gap-3 p-4">
            {/* Bulk toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 p-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={allSelected}
                  onChange={toggleAll}
                />
                <span className="font-medium">
                  {selected.size} of {groups.length} selected
                </span>
              </label>
              <Button
                size="sm"
                className="h-8"
                disabled={pending.length === 0 || applying}
                onClick={apply}
              >
                {applying ? 'Applying…' : `Apply ${pending.length} (${txPending} txns)`}
              </Button>
            </div>
            {notice ? <p className="text-muted-foreground text-xs">{notice}</p> : null}

            {/* Rows */}
            <div className={cn('flex flex-col divide-y', loading && 'opacity-60')}>
              {pageItems.map((g) => {
                const badge = sourceBadge(g.source)
                return (
                  <div key={g.key} className="flex flex-wrap items-center gap-3 py-2.5">
                    <input
                      type="checkbox"
                      className="size-4 shrink-0 accent-primary"
                      checked={selected.has(g.key)}
                      onChange={() => toggleOne(g.key)}
                      aria-label={`Select ${g.sampleDescription}`}
                    />
                    <div className="min-w-0 flex-1 basis-52">
                      <p className="truncate font-medium text-sm">{g.sampleDescription}</p>
                      <p className="flex items-center gap-2 text-muted-foreground text-xs">
                        <span>
                          {g.count} txn{g.count === 1 ? '' : 's'}
                        </span>
                        <span
                          className={cn(
                            'rounded px-1.5 py-0.5 font-medium text-[10px]',
                            badge.className,
                          )}
                        >
                          {badge.label}
                        </span>
                        {g.confidence > 0 ? <span>{Math.round(g.confidence * 100)}%</span> : null}
                      </p>
                    </div>

                    <Input
                      value={effectiveName(g)}
                      placeholder="Display name (optional)"
                      className="h-8 w-44"
                      onChange={(e) => setName(g.key, e.target.value)}
                    />

                    <Select
                      value={effectiveCat(g)}
                      onValueChange={(v) => setCat(g.key, v ?? NO_CATEGORY)}
                    >
                      <SelectTrigger className="h-8 w-44">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_CATEGORY}>No category</SelectItem>
                        {(result?.categories ?? []).map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            <span className="flex items-center gap-2">
                              <CategoryIcon name={c.icon} color={c.color} className="size-4" />
                              {c.name}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )
              })}
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
          </CardContent>
        </Card>
      )}
    </div>
  )
}
