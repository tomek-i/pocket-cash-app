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
import { getAiConfig, getDefaultCurrency } from '../settings/actions'
import { fyLabel, fyRangeLabel, getFyCategoryBreakdowns, listFinancialYears } from './queries'

export interface InsightView {
  summary: string
  highlights: string[]
  /** ISO timestamp. */
  generatedAt: string
  /** True when the underlying data changed since this was generated. */
  stale: boolean
}

export type GenerateResult = InsightView | { error: string }

/** Signed percentage change as a display string, or null when there's no base. */
function pctChange(curr: number, prev: number): string | null {
  if (prev <= 0) return null
  const p = ((curr - prev) / prev) * 100
  return `${p >= 0 ? '+' : ''}${p.toFixed(0)}%`
}

/** Gather pre-computed, human-readable facts for one FY (money pre-formatted). */
async function buildFyFacts(
  fy: number,
): Promise<{ facts: Record<string, unknown>; fingerprint: string } | null> {
  const currency = await getDefaultCurrency()
  const [years, breakdowns] = await Promise.all([listFinancialYears(), getFyCategoryBreakdowns()])
  const summary = years.find((y) => y.fy === fy)
  if (!summary || summary.count === 0) return null

  const prev = years.find((y) => y.fy === fy - 1) ?? null
  const breakdown = breakdowns.get(fy)
  const savingsRate =
    summary.income > 0 ? `${Math.round((summary.net / summary.income) * 100)}%` : 'n/a'
  const topCategories = (breakdown?.slices ?? []).map((s) => ({
    name: s.label,
    spent: formatMoney(s.value, currency),
    shareOfSpending:
      breakdown && breakdown.total > 0 ? `${Math.round((s.value / breakdown.total) * 100)}%` : '0%',
  }))

  const facts = {
    period: fyRangeLabel(fy),
    currency,
    income: formatMoney(summary.income, currency),
    spending: formatMoney(summary.spending, currency),
    net: formatMoney(summary.net, currency),
    savedThisYear: summary.net >= 0,
    savingsRateOfIncome: savingsRate,
    transactionCount: summary.count,
    versusPriorYear: prev
      ? {
          priorPeriod: fyLabel(prev.fy),
          incomeChange: pctChange(summary.income, prev.income),
          spendingChange: pctChange(summary.spending, prev.spending),
          priorNet: formatMoney(prev.net, currency),
        }
      : null,
    topSpendingCategories: topCategories,
  }

  // Fingerprint the raw numbers that would change the narrative.
  const fingerprint = JSON.stringify([
    summary.income,
    summary.spending,
    summary.net,
    summary.count,
    prev?.net ?? null,
    breakdown?.slices.map((s) => [s.label, s.value] as const) ?? [],
  ])
  return { facts, fingerprint }
}

/** Return the cached FY summary (if any), flagged stale when the data moved on. */
export async function getFyInsight(fy: number): Promise<InsightView | null> {
  const cached = (await getAppSettings()).aiInsights?.[`fy${fy}`]
  if (!cached) return null
  const built = await buildFyFacts(fy)
  return {
    summary: cached.summary,
    highlights: cached.highlights,
    generatedAt: cached.generatedAt,
    stale: !built || built.fingerprint !== cached.fingerprint,
  }
}

/** Generate (and cache) an AI summary for one FY. Requires AI to be enabled. */
export async function generateFyInsight(fy: number): Promise<GenerateResult> {
  const config = await getAiConfig()
  if (!isAiEnabled(config)) return { error: 'AI is turned off. Enable it in Settings.' }

  const built = await buildFyFacts(fy)
  if (!built) return { error: 'No transactions in this financial year to summarise.' }

  let result: { summary: string; highlights: string[] }
  try {
    result = await summarise({
      config,
      subject: `${fyLabel(fy)} (${fyRangeLabel(fy)})`,
      facts: built.facts,
    })
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
    aiInsights: { ...(current.aiInsights ?? {}), [`fy${fy}`]: entry },
  }
  await saveAppSettings(next)
  revalidatePath(`/app/reports/${fy}`)

  return { summary: entry.summary, highlights: entry.highlights, generatedAt, stale: false }
}
