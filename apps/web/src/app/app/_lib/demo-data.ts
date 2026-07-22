import type { AccountType, BillingCycle } from '@repo/types'
import { DEFAULT_CATEGORIES } from '../categories/default-categories'

/**
 * The demo dataset offered on first run ("Start with demo data") and re-loadable
 * from Settings → "Reset & load demo data". This module is PURE — no DB access.
 * It describes a realistic single-user finance history relative to a base date so
 * the sample always looks current; @repo/database seeding lives in ./seed-actions.
 *
 * Amounts are signed integer minor units (cents): negative = money out. Entities
 * reference categories/accounts by name/key; the seeder resolves those to ids.
 */

export interface DemoAccountDef {
  /** Stable key used to attach transactions to this account. */
  key: 'checking' | 'savings'
  name: string
  type: AccountType
  currency: string
  openingBalance: number
}

export interface DemoTagDef {
  name: string
  color: string
}

export interface DemoSubscriptionDef {
  name: string
  amount: number // positive minor units
  cycle: BillingCycle
  categoryName: string
  matcher: string // lowercase description substring
  /** Days from the base date to the next payment. */
  nextPaymentInDays: number
}

export interface DemoTxnDef {
  accountKey: DemoAccountDef['key']
  date: string // YYYY-MM-DD
  description: string
  merchant?: string
  amount: number // signed minor units
  currency: string
  categoryName: string
  tagNames?: string[]
}

export interface DemoData {
  bank: { name: string; country: string }
  accounts: DemoAccountDef[]
  categories: typeof DEFAULT_CATEGORIES
  tags: DemoTagDef[]
  subscriptions: DemoSubscriptionDef[]
  transactions: DemoTxnDef[]
}

const CURRENCY = 'USD'

const BANK = { name: 'Everyday Bank', country: 'US' }

const ACCOUNTS: DemoAccountDef[] = [
  {
    key: 'checking',
    name: 'Everyday Checking',
    type: 'checking',
    currency: CURRENCY,
    openingBalance: 250_000, // $2,500.00
  },
  {
    key: 'savings',
    name: 'Rainy Day Savings',
    type: 'savings',
    currency: CURRENCY,
    openingBalance: 1_200_000, // $12,000.00
  },
]

const TAGS: DemoTagDef[] = [
  { name: 'Reimbursable', color: '#0ea5e9' },
  { name: 'Business', color: '#7c3aed' },
  { name: 'Holiday', color: '#ea580c' },
]

const SUBSCRIPTIONS: DemoSubscriptionDef[] = [
  {
    name: 'Netflix',
    amount: 1599, // $15.99
    cycle: 'monthly',
    categoryName: 'Entertainment',
    matcher: 'netflix',
    nextPaymentInDays: 12,
  },
  {
    name: 'FitLife Gym',
    amount: 3900, // $39.00
    cycle: 'monthly',
    categoryName: 'Health',
    matcher: 'fitlife',
    nextPaymentInDays: 3,
  },
]

/** Zero-padded YYYY-MM-DD in local time. */
function ymd(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** A concrete calendar date, clamped to the given month's length. */
function dayInMonth(year: number, monthIndex: number, day: number): Date {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate()
  return new Date(year, monthIndex, Math.min(day, lastDay))
}

/** Pick from a non-empty list, wrapping the index — always defined. */
function cycle<T>(list: readonly T[], i: number): T {
  return list[i % list.length] as T
}

// Deterministic variety without Math.random — cycled by month so re-seeding is
// stable and the data reads like a real, uneven spending history.
const GROCERIES = [
  { merchant: 'Whole Foods', amount: -8_450 },
  { merchant: 'Trader Joe’s', amount: -4_215 },
  { merchant: 'Costco', amount: -12_780 },
  { merchant: 'Local Market', amount: -3_190 },
]
const DINING = [
  { merchant: 'Blue Bottle Coffee', amount: -725 },
  { merchant: 'Sushi Nakamura', amount: -6_240 },
  { merchant: 'Taco Truck', amount: -1_450 },
  { merchant: 'The Corner Bistro', amount: -4_880 },
]
const TRANSPORT = [
  { merchant: 'Uber', amount: -2_310 },
  { merchant: 'Shell Gas', amount: -5_600 },
  { merchant: 'Metro Transit', amount: -1_200 },
]
const ONE_OFFS = [
  { merchant: 'Amazon', amount: -6_799, category: 'Shopping' },
  { merchant: 'Delta Airlines', amount: -28_400, category: 'Travel', tags: ['Holiday'] },
  { merchant: 'Apple Store', amount: -12_900, category: 'Shopping' },
  { merchant: 'City Cinema', amount: -3_600, category: 'Entertainment' },
  { merchant: 'Pharmacy Plus', amount: -2_240, category: 'Health' },
]

/**
 * Build the full demo dataset relative to `now`, spanning a full year — the last
 * twelve months plus the current month to date. That's enough history to populate
 * the reports (including a complete previous financial year), the net-worth trend
 * and the dashboard's month picker. Recurring income/bills/subscriptions, everyday
 * spending, transfers between the two accounts, and a few one-offs.
 */
export function buildDemoData(now: Date): DemoData {
  const transactions: DemoTxnDef[] = []
  const add = (t: DemoTxnDef) => transactions.push(t)

  const MONTHS_BACK = 12
  for (let back = MONTHS_BACK; back >= 0; back--) {
    const anchor = new Date(now.getFullYear(), now.getMonth() - back, 1)
    const y = anchor.getFullYear()
    const m = anchor.getMonth()
    const isCurrentMonth = back === 0
    const today = now.getDate()
    // Only emit an event if its day has already occurred in the current month.
    const due = (day: number) => !isCurrentMonth || day <= today

    // Salary — 25th, into checking.
    if (due(25)) {
      add({
        accountKey: 'checking',
        date: ymd(dayInMonth(y, m, 25)),
        description: 'ACME Corp Payroll',
        merchant: 'ACME Corp',
        amount: 320_000, // $3,200.00
        currency: CURRENCY,
        categoryName: 'Salary',
      })
    }

    // Rent — 1st.
    if (due(1)) {
      add({
        accountKey: 'checking',
        date: ymd(dayInMonth(y, m, 1)),
        description: 'Rent Payment — Oakwood Apartments',
        merchant: 'Oakwood Apartments',
        amount: -140_000, // $1,400.00
        currency: CURRENCY,
        categoryName: 'Housing & Rent',
      })
    }

    // Utilities — 15th.
    if (due(15)) {
      add({
        accountKey: 'checking',
        date: ymd(dayInMonth(y, m, 15)),
        description: 'City Utilities — Electric & Water',
        merchant: 'City Utilities',
        amount: -12_050, // $120.50
        currency: CURRENCY,
        categoryName: 'Bills & Utilities',
      })
    }

    // Netflix — 12th.
    if (due(12)) {
      add({
        accountKey: 'checking',
        date: ymd(dayInMonth(y, m, 12)),
        description: 'Netflix Monthly Subscription',
        merchant: 'Netflix',
        amount: -1_599,
        currency: CURRENCY,
        categoryName: 'Entertainment',
      })
    }

    // Gym — 3rd.
    if (due(3)) {
      add({
        accountKey: 'checking',
        date: ymd(dayInMonth(y, m, 3)),
        description: 'FitLife Gym Membership',
        merchant: 'FitLife Gym',
        amount: -3_900,
        currency: CURRENCY,
        categoryName: 'Health',
      })
    }
    // Groceries — weekly-ish (5th, 12th, 19th, 26th).
    ;[5, 12, 19, 26].forEach((day, i) => {
      if (!due(day)) return
      const pick = cycle(GROCERIES, back + i)
      add({
        accountKey: 'checking',
        date: ymd(dayInMonth(y, m, day)),
        description: `${pick.merchant} — groceries`,
        merchant: pick.merchant,
        amount: pick.amount,
        currency: CURRENCY,
        categoryName: 'Groceries',
      })
    })

    // Dining — 8th, 21st.
    ;[8, 21].forEach((day, i) => {
      if (!due(day)) return
      const pick = cycle(DINING, back + i)
      add({
        accountKey: 'checking',
        date: ymd(dayInMonth(y, m, day)),
        description: pick.merchant,
        merchant: pick.merchant,
        amount: pick.amount,
        currency: CURRENCY,
        categoryName: 'Dining Out',
      })
    })

    // Transport — 6th, 18th.
    ;[6, 18].forEach((day, i) => {
      if (!due(day)) return
      const pick = cycle(TRANSPORT, back + i)
      add({
        accountKey: 'checking',
        date: ymd(dayInMonth(y, m, day)),
        description: pick.merchant,
        merchant: pick.merchant,
        amount: pick.amount,
        currency: CURRENCY,
        categoryName: 'Transport',
      })
    })

    // A rotating one-off — 20th.
    if (due(20)) {
      const pick = cycle(ONE_OFFS, back)
      add({
        accountKey: 'checking',
        date: ymd(dayInMonth(y, m, 20)),
        description: pick.merchant,
        merchant: pick.merchant,
        amount: pick.amount,
        currency: CURRENCY,
        categoryName: pick.category,
        tagNames: pick.tags,
      })
    }

    // Monthly transfer to savings — 26th (out of checking, into savings).
    if (due(26)) {
      const transferDate = ymd(dayInMonth(y, m, 26))
      add({
        accountKey: 'checking',
        date: transferDate,
        description: 'Transfer to Rainy Day Savings',
        amount: -40_000, // $400.00
        currency: CURRENCY,
        categoryName: 'Transfers',
      })
      add({
        accountKey: 'savings',
        date: transferDate,
        description: 'Transfer from Everyday Checking',
        amount: 40_000,
        currency: CURRENCY,
        categoryName: 'Transfers',
      })
    }
  }

  // A little savings interest, latest full month.
  const interestAnchor = new Date(now.getFullYear(), now.getMonth() - 1, 28)
  add({
    accountKey: 'savings',
    date: ymd(interestAnchor),
    description: 'Savings Interest',
    merchant: 'Everyday Bank',
    amount: 1_842, // $18.42
    currency: CURRENCY,
    categoryName: 'Other Income',
  })

  return {
    bank: BANK,
    accounts: ACCOUNTS,
    categories: DEFAULT_CATEGORIES,
    tags: TAGS,
    subscriptions: SUBSCRIPTIONS,
    transactions,
  }
}
