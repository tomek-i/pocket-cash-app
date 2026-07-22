import { describe, expect, it } from 'vitest'
import { DEFAULT_CATEGORIES } from '../categories/default-categories'
import { buildDemoData } from './demo-data'

// A fixed "now" keeps the generated history deterministic across runs.
const NOW = new Date(2026, 6, 22) // 2026-07-22

describe('buildDemoData', () => {
  const data = buildDemoData(NOW)
  const categoryNames = new Set(DEFAULT_CATEGORIES.map((c) => c.name))
  const accountKeys = new Set(data.accounts.map((a) => a.key))

  it('produces a bank, two accounts and a non-empty transaction history', () => {
    expect(data.bank.name).toBeTruthy()
    expect(data.accounts).toHaveLength(2)
    expect(data.transactions.length).toBeGreaterThan(20)
  })

  it('references only known categories and accounts', () => {
    for (const t of data.transactions) {
      expect(categoryNames.has(t.categoryName)).toBe(true)
      expect(accountKeys.has(t.accountKey)).toBe(true)
    }
    for (const s of data.subscriptions) {
      expect(categoryNames.has(s.categoryName)).toBe(true)
    }
  })

  it('never dates a transaction in the future', () => {
    const todayYmd = '2026-07-22'
    for (const t of data.transactions) {
      expect(t.date <= todayYmd).toBe(true)
    }
  })

  it('signs income positive and spending negative', () => {
    const salary = data.transactions.filter((t) => t.categoryName === 'Salary')
    const rent = data.transactions.filter((t) => t.categoryName === 'Housing & Rent')
    expect(salary.length).toBeGreaterThan(0)
    expect(salary.every((t) => t.amount > 0)).toBe(true)
    expect(rent.every((t) => t.amount < 0)).toBe(true)
  })

  it('keeps inter-account transfers balanced (each out has a matching in)', () => {
    const transfers = data.transactions.filter((t) => t.categoryName === 'Transfers')
    const net = transfers.reduce((sum, t) => sum + t.amount, 0)
    expect(net).toBe(0)
  })
})
