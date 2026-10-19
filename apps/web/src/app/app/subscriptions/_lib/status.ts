import { db, lt, sql, transactions } from '@repo/database'
import type { BillingCycle } from '@repo/types'
import {
  normalizeText,
  type PaymentStatus,
  paymentStatus,
  type StatusFields,
  todayIso,
} from './schedule'

interface Schedule extends StatusFields {
  id: string
  cycle: BillingCycle
  nextPaymentDate: string | null
  matcher: string | null
}

/** Payment status per subscription id, checked against the imported transactions. */
export async function loadPaymentStatuses(subs: Schedule[]): Promise<Map<string, PaymentStatus>> {
  const today = todayIso()
  // Only a subscription with a matcher and a passed date can be "not seen", so
  // skip the transaction scan when there is none.
  const needsCharges = subs.some((s) => s.matcher && s.nextPaymentDate && s.nextPaymentDate < today)

  let charges: { text: string; date: string }[] = []
  let dataThrough: string | null = null
  if (needsCharges) {
    const [rows, [latest]] = await Promise.all([
      db
        .select({
          description: transactions.description,
          merchant: transactions.merchant,
          date: transactions.date,
        })
        .from(transactions)
        .where(lt(transactions.amount, 0)),
      db.select({ date: sql<string | null>`max(${transactions.date})` }).from(transactions),
    ])
    charges = rows.map((r) => ({
      text: normalizeText(`${r.merchant ?? ''} ${r.description ?? ''}`),
      date: r.date,
    }))
    dataThrough = latest?.date ?? null
  }

  return new Map(subs.map((s) => [s.id, paymentStatus(s, { today, charges, dataThrough })]))
}
