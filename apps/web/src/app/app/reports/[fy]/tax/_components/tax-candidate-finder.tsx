'use client'

import { Badge, Button, Card, CardContent } from '@repo/ui'
import { Sparkles } from 'lucide-react'
import Link from 'next/link'
import { useMemo, useState, useTransition } from 'react'
import { formatMoney } from '@/lib/money'
import { applyTaxTag, findTaxCandidates, type TaxCandidateRow } from '../../../tax-actions'

// Preferred display order for the AI's "kind" buckets; unknown kinds sort after.
const KIND_ORDER = ['work expense', 'donation', 'investment', 'education', 'income', 'other']

function kindOf(c: TaxCandidateRow): string {
  return c.kind?.trim().toLowerCase() || 'other'
}

function groupByKind(rows: TaxCandidateRow[]): { kind: string; items: TaxCandidateRow[] }[] {
  const byKind = new Map<string, TaxCandidateRow[]>()
  for (const c of rows) {
    const k = kindOf(c)
    const list = byKind.get(k) ?? []
    list.push(c)
    byKind.set(k, list)
  }
  return [...byKind.entries()]
    .map(([kind, items]) => ({ kind, items }))
    .sort((a, b) => {
      const ai = KIND_ORDER.indexOf(a.kind)
      const bi = KIND_ORDER.indexOf(b.kind)
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi) || a.kind.localeCompare(b.kind)
    })
}

export function TaxCandidateFinder({ fy, aiConfigured }: { fy: number; aiConfigured: boolean }) {
  const [candidates, setCandidates] = useState<TaxCandidateRow[] | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [minConfidence, setMinConfidence] = useState(50)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [scanning, startScan] = useTransition()
  const [applying, startApply] = useTransition()

  const filtered = useMemo(
    () => (candidates ?? []).filter((c) => Math.round(c.confidence * 100) >= minConfidence),
    [candidates, minConfidence],
  )
  const groups = useMemo(() => groupByKind(filtered), [filtered])
  const visibleIds = useMemo(() => new Set(filtered.map((c) => c.transactionId)), [filtered])
  const selectedVisible = [...selected].filter((id) => visibleIds.has(id))
  const allVisibleSelected = filtered.length > 0 && selectedVisible.length === filtered.length

  const scan = () =>
    startScan(async () => {
      setError(null)
      setNotice(null)
      const res = await findTaxCandidates(fy)
      if ('error' in res) {
        setError(res.error)
        return
      }
      setCandidates(res.candidates)
      setSelected(new Set(res.candidates.map((c) => c.transactionId)))
      setNotice(
        res.candidates.length === 0
          ? `Scanned ${res.scanned} transaction(s) — nothing looks tax-relevant.`
          : `Found ${res.candidates.length} across ${res.scanned} scanned${res.truncated ? ` (first ${res.scanned} only — re-scan after tagging)` : ''}.`,
      )
    })

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const toggleAllVisible = () =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (allVisibleSelected) for (const id of visibleIds) next.delete(id)
      else for (const id of visibleIds) next.add(id)
      return next
    })

  const apply = () =>
    startApply(async () => {
      setError(null)
      const ids = selectedVisible
      if (ids.length === 0) return
      const res = await applyTaxTag(fy, ids)
      if ('error' in res) {
        setError(res.error)
        return
      }
      const tagged = new Set(ids)
      setNotice(`Tagged ${res.tagged} transaction(s) as “tax”.`)
      setCandidates((prev) => prev?.filter((c) => !tagged.has(c.transactionId)) ?? null)
      setSelected((prev) => new Set([...prev].filter((id) => !tagged.has(id))))
    })

  if (!aiConfigured) {
    return (
      <Card>
        <CardContent className="p-5">
          <p className="text-muted-foreground text-sm">
            <Link href="/app/settings" className="text-primary hover:underline">
              Enable AI in Settings
            </Link>{' '}
            to scan FY{fy} for likely deductions and work-related expenses.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button className="gap-1.5" disabled={scanning} onClick={scan}>
          <Sparkles className="size-4" />
          {scanning ? 'Scanning…' : candidates ? 'Re-scan' : 'Scan with AI'}
        </Button>
        {candidates && candidates.length > 0 ? (
          <label className="flex items-center gap-2 text-muted-foreground text-sm">
            Min confidence · {minConfidence}%
            <input
              type="range"
              min={0}
              max={90}
              step={5}
              value={minConfidence}
              onChange={(e) => setMinConfidence(Number(e.target.value))}
              className="w-40 accent-primary"
            />
          </label>
        ) : null}
      </div>

      {notice ? <p className="text-muted-foreground text-sm">{notice}</p> : null}
      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      {candidates && candidates.length > 0 ? (
        filtered.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No candidates at or above {minConfidence}% confidence. Lower the threshold to see more.
          </p>
        ) : (
          <>
            {/* Sticky apply bar */}
            <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card/95 p-3 backdrop-blur">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={allVisibleSelected}
                  onChange={toggleAllVisible}
                />
                <span className="font-medium">
                  {selectedVisible.length} of {filtered.length} selected
                </span>
              </label>
              <Button
                size="sm"
                className="h-8"
                disabled={selectedVisible.length === 0 || applying}
                onClick={apply}
              >
                {applying ? 'Tagging…' : `Tag ${selectedVisible.length} as “tax”`}
              </Button>
            </div>

            {/* Grouped by deduction type */}
            {groups.map((group) => (
              <Card key={group.kind}>
                <CardContent className="flex flex-col gap-1 p-4">
                  <p className="mb-1 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                    {group.kind} · {group.items.length}
                  </p>
                  <div className="flex flex-col divide-y">
                    {group.items.map((c) => (
                      <label
                        key={c.transactionId}
                        className="flex cursor-pointer items-start gap-3 py-2.5"
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5 size-4 shrink-0 accent-primary"
                          checked={selected.has(c.transactionId)}
                          onChange={() => toggle(c.transactionId)}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-3">
                            <p className="truncate font-medium text-sm">{c.description}</p>
                            <span className="shrink-0 text-sm tabular-nums">
                              {formatMoney(c.amount, c.currency)}
                            </span>
                          </div>
                          <p className="text-muted-foreground text-xs">{c.reason}</p>
                        </div>
                        <Badge variant="secondary" className="shrink-0 px-1.5 py-0 text-[10px]">
                          {Math.round(c.confidence * 100)}%
                        </Badge>
                      </label>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}

            <p className="text-[11px] text-muted-foreground">
              Suggestions only — not tax advice. Review each item and confirm with a registered tax
              agent. Tagged items appear in the FY tax summary and the{' '}
              <Link href={`/app/reports/${fy}?tag=tax`} className="text-primary hover:underline">
                tax filter
              </Link>
              .
            </p>
          </>
        )
      ) : null}
    </div>
  )
}
