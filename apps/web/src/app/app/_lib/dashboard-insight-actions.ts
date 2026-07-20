'use server'

import { isAiEnabled, summarise } from '@repo/ai'
import {
  type AppSettings,
  type CachedInsight,
  getAppSettings,
  saveAppSettings,
} from '@repo/database'
import { revalidatePath } from 'next/cache'
import { formatMoney } from '@/lib/money'
import type { GenerateResult, InsightView } from '../reports/insights-actions'
import { getAiConfig } from '../settings/actions'
import { getDashboardData } from './dashboard'

const KEY = 'dashboard'

function pct(value: number | null): string | null {
  if (value === null) return null
  return `${value >= 0 ? '+' : ''}${value.toFixed(0)}%`
}

/** Pre-computed facts for the current month + net worth (money pre-formatted). */
async function buildDashboardFacts(): Promise<{
  facts: Record<string, unknown>
  subject: string
  fingerprint: string
} | null> {
  const data = await getDashboardData()
  if (data.recent.length === 0) return null // nothing worth summarising yet

  const now = new Date()
  const monthLabel = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const c = data.currency

  const facts = {
    month: monthLabel,
    currency: c,
    netWorth: formatMoney(data.netWorth, c),
    netWorthChangeVsLastMonth: pct(data.netWorthChangePct),
    incomeThisMonth: formatMoney(data.income, c),
    spendingThisMonth: formatMoney(data.spending, c),
    netThisMonth: formatMoney(data.income - data.spending, c),
    incomeChangeVsLastMonth: pct(data.incomeChangePct),
    spendingChangeVsLastMonth: pct(data.spendingChangePct),
    topSpendingCategories: data.categorySpend.map((s) => ({
      name: s.label,
      spent: formatMoney(s.value, c),
    })),
    recurringSubscriptionsPerMonth: formatMoney(data.subsMonthlyTotal, c),
    upcomingSubscriptions: data.subscriptions.map((s) => s.name),
  }

  const fingerprint = JSON.stringify([
    monthLabel,
    data.netWorth,
    data.income,
    data.spending,
    data.monthSpendTotal,
    data.categorySpend.map((s) => [s.label, s.value] as const),
    data.subsMonthlyTotal,
  ])
  return { facts, subject: `this person's finances in ${monthLabel}`, fingerprint }
}

/** Cached dashboard summary (if any), flagged stale when the data moved on. */
export async function getDashboardInsight(): Promise<InsightView | null> {
  const cached = (await getAppSettings()).aiInsights?.[KEY]
  if (!cached) return null
  const built = await buildDashboardFacts()
  return {
    summary: cached.summary,
    highlights: cached.highlights,
    generatedAt: cached.generatedAt,
    stale: !built || built.fingerprint !== cached.fingerprint,
  }
}

/** Generate (and cache) the dashboard summary. Requires AI to be enabled. */
export async function generateDashboardInsight(): Promise<GenerateResult> {
  const config = await getAiConfig()
  if (!isAiEnabled(config)) return { error: 'AI is turned off. Enable it in Settings.' }

  const built = await buildDashboardFacts()
  if (!built) return { error: 'Import some transactions first — nothing to summarise yet.' }

  let result: { summary: string; highlights: string[] }
  try {
    result = await summarise({ config, subject: built.subject, facts: built.facts })
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Failed to generate summary' }
  }

  const generatedAt = new Date().toISOString()
  const entry: CachedInsight = {
    fingerprint: built.fingerprint,
    summary: result.summary,
    highlights: result.highlights,
    generatedAt,
  }
  const current = await getAppSettings()
  const next: AppSettings = {
    ...current,
    aiInsights: { ...(current.aiInsights ?? {}), [KEY]: entry },
  }
  await saveAppSettings(next)
  revalidatePath('/app')

  return { summary: entry.summary, highlights: entry.highlights, generatedAt, stale: false }
}
