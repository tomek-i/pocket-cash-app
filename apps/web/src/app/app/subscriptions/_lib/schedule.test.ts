import { describe, expect, it } from 'vitest'
import {
  byPaymentStatus,
  isBilling,
  lifecycle,
  normalizeText,
  paymentStatus,
  rollForward,
} from './schedule'

describe('rollForward', () => {
  it('leaves a date that has not passed alone', () => {
    expect(rollForward('2026-10-15', 'monthly', '2026-10-12')).toEqual({
      next: '2026-10-15',
      lastDue: null,
    })
  })

  it('treats a payment due today as upcoming', () => {
    expect(rollForward('2026-10-12', 'monthly', '2026-10-12').next).toBe('2026-10-12')
  })

  it('rolls a passed monthly date to the next one on the same day of month', () => {
    expect(rollForward('2026-08-15', 'monthly', '2026-10-12')).toEqual({
      next: '2026-10-15',
      lastDue: '2026-09-15',
    })
  })

  it('clamps to the end of a short month without drifting', () => {
    expect(rollForward('2026-01-31', 'monthly', '2026-02-10').next).toBe('2026-02-28')
    expect(rollForward('2026-01-31', 'monthly', '2026-03-10').next).toBe('2026-03-31')
  })

  it('steps weekly, quarterly and yearly cycles', () => {
    expect(rollForward('2026-10-01', 'weekly', '2026-10-12').next).toBe('2026-10-15')
    expect(rollForward('2026-01-20', 'quarterly', '2026-10-12').next).toBe('2026-10-20')
    expect(rollForward('2024-03-05', 'yearly', '2026-10-12').next).toBe('2027-03-05')
  })
})

describe('paymentStatus', () => {
  const netflix = { cycle: 'monthly' as const, nextPaymentDate: '2026-08-15', matcher: 'netflix' }
  const charge = (date: string) => ({ text: normalizeText('NETFLIX.COM 12345'), date })

  it('has no status without a stored date', () => {
    expect(
      paymentStatus(
        { ...netflix, nextPaymentDate: null },
        { today: '2026-10-12', charges: [], dataThrough: null },
      ),
    ).toEqual({ kind: 'unknown' })
  })

  it('shows the rolled date when the last charge was seen', () => {
    expect(
      paymentStatus(netflix, {
        today: '2026-10-12',
        charges: [charge('2026-08-15'), charge('2026-09-16')],
        dataThrough: '2026-10-10',
      }),
    ).toEqual({ kind: 'upcoming', date: '2026-10-15' })
  })

  it('flags a charge that is missing from transactions that cover its due date', () => {
    expect(
      paymentStatus(netflix, {
        today: '2026-10-12',
        charges: [charge('2026-08-15')],
        dataThrough: '2026-10-10',
      }),
    ).toEqual({ kind: 'not-seen', lastSeen: '2026-08-15' })
  })

  it('does not flag when nothing has been imported since the due date', () => {
    expect(
      paymentStatus(netflix, {
        today: '2026-10-12',
        charges: [charge('2026-08-15')],
        dataThrough: '2026-08-20',
      }),
    ).toEqual({ kind: 'upcoming', date: '2026-10-15' })
  })

  it('does not flag a subscription with no matcher', () => {
    expect(
      paymentStatus(
        { ...netflix, matcher: null },
        { today: '2026-10-12', charges: [], dataThrough: '2026-10-10' },
      ),
    ).toEqual({ kind: 'upcoming', date: '2026-10-15' })
  })
})

describe('byPaymentStatus', () => {
  it('puts the soonest payment first and unseen ones after', () => {
    const sorted = [
      { kind: 'not-seen' as const, lastSeen: null },
      { kind: 'upcoming' as const, date: '2026-10-20' },
      { kind: 'unknown' as const },
      { kind: 'upcoming' as const, date: '2026-10-13' },
    ].sort(byPaymentStatus)
    expect(sorted.map((s) => s.kind)).toEqual(['upcoming', 'upcoming', 'not-seen', 'unknown'])
    expect(sorted[0]).toEqual({ kind: 'upcoming', date: '2026-10-13' })
  })
})

describe('lifecycle', () => {
  const today = '2026-10-19'
  const set = (status: 'active' | 'paused' | 'cancelled', dates = {}) => ({
    status,
    pausedUntil: null,
    endDate: null,
    ...dates,
  })

  it('keeps an open-ended pause paused', () => {
    expect(lifecycle(set('paused'), today)).toEqual({ kind: 'paused', until: null })
  })

  it('ends a timed pause on its date by itself', () => {
    expect(lifecycle(set('paused', { pausedUntil: '2026-12-01' }), today)).toEqual({
      kind: 'paused',
      until: '2026-12-01',
    })
    expect(lifecycle(set('paused', { pausedUntil: today }), today)).toEqual({
      kind: 'active',
      endsOn: null,
      resumedOn: today,
    })
  })

  it('keeps billing until a cancellation date that is still to come', () => {
    expect(lifecycle(set('cancelled', { endDate: '2026-11-01' }), today)).toEqual({
      kind: 'active',
      endsOn: '2026-11-01',
      resumedOn: null,
    })
    expect(isBilling(set('cancelled', { endDate: today }), today)).toBe(false)
    expect(isBilling(set('cancelled'), today)).toBe(false)
  })
})

describe('paymentStatus with a status', () => {
  const base = { cycle: 'monthly' as const, nextPaymentDate: '2026-08-15', matcher: 'netflix' }
  const context = { today: '2026-10-19', charges: [], dataThrough: '2026-10-18' }

  it('shows no payment for a cancelled or open-ended paused subscription', () => {
    const cancelled = { ...base, status: 'cancelled' as const, pausedUntil: null, endDate: null }
    expect(paymentStatus(cancelled, context)).toEqual({ kind: 'unknown' })
    const paused = { ...base, status: 'paused' as const, pausedUntil: null, endDate: null }
    expect(paymentStatus(paused, context)).toEqual({ kind: 'unknown' })
  })

  it('shows the first payment after a timed pause', () => {
    const paused = { ...base, status: 'paused' as const, pausedUntil: '2027-01-10', endDate: null }
    expect(paymentStatus(paused, context)).toEqual({ kind: 'upcoming', date: '2027-01-15' })
  })

  it('does not flag a payment that fell inside a pause as missing', () => {
    // 15 Oct is due and the data covers it, but the pause only ran out on the 16th.
    const later = { today: '2026-10-22', charges: [], dataThrough: '2026-10-21' }
    const resumed = { ...base, status: 'paused' as const, pausedUntil: '2026-10-16', endDate: null }
    expect(paymentStatus(resumed, later)).toEqual({ kind: 'upcoming', date: '2026-11-15' })
    expect(paymentStatus({ ...resumed, status: 'active' }, later)).toEqual({
      kind: 'not-seen',
      lastSeen: null,
    })
  })

  it('stops showing payments from the end date of a cancellation', () => {
    const ending = {
      ...base,
      status: 'cancelled' as const,
      pausedUntil: null,
      endDate: '2026-11-15',
    }
    expect(paymentStatus({ ...ending, matcher: null }, context)).toEqual({ kind: 'unknown' })
    expect(paymentStatus({ ...ending, matcher: null, endDate: '2026-11-20' }, context)).toEqual({
      kind: 'upcoming',
      date: '2026-11-15',
    })
  })
})
