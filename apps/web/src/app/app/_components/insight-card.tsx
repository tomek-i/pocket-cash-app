'use client'

import { Button, Card, CardContent } from '@repo/ui'
import { RefreshCw, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { useState, useTransition } from 'react'
import type { GenerateResult, InsightView } from '../reports/insights-actions'

export function InsightCard({
  aiConfigured,
  initial,
  generate,
  prompt,
}: {
  aiConfigured: boolean
  initial: InsightView | null
  /** Bound server action that produces (and caches) the summary. */
  generate: () => Promise<GenerateResult>
  /** Copy shown above the "Generate" button before a summary exists. */
  prompt: string
}) {
  const [insight, setInsight] = useState<InsightView | null>(initial)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const run = () =>
    start(async () => {
      setError(null)
      const res = await generate()
      if ('error' in res) {
        setError(res.error)
        return
      }
      setInsight(res)
    })

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-2 font-medium text-sm">
            <Sparkles className="size-4 text-primary" />
            AI summary
          </p>
          {aiConfigured && insight ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-muted-foreground"
              disabled={pending}
              onClick={run}
            >
              <RefreshCw className="size-3.5" />
              {pending ? 'Regenerating…' : 'Regenerate'}
            </Button>
          ) : null}
        </div>

        {insight ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm leading-relaxed">{insight.summary}</p>
            {insight.highlights.length > 0 ? (
              <ul className="flex flex-col gap-1.5">
                {insight.highlights.map((h) => (
                  <li key={h} className="flex gap-2 text-muted-foreground text-sm">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary/60" />
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="text-[11px] text-muted-foreground">
              Generated {insight.generatedAt.slice(0, 10)}
              {insight.stale ? ' · data has changed since — regenerate to refresh' : ''}. AI-written
              from your figures; verify anything important.
            </p>
          </div>
        ) : aiConfigured ? (
          <div className="flex flex-col items-start gap-3">
            <p className="text-muted-foreground text-sm">{prompt}</p>
            <Button size="sm" className="gap-1.5" disabled={pending} onClick={run}>
              <Sparkles className="size-4" />
              {pending ? 'Generating…' : 'Generate summary'}
            </Button>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            <Link href="/app/settings" className="text-primary hover:underline">
              Enable AI in Settings
            </Link>{' '}
            to get a written summary.
          </p>
        )}

        {error ? <p className="text-destructive text-xs">{error}</p> : null}
      </CardContent>
    </Card>
  )
}
