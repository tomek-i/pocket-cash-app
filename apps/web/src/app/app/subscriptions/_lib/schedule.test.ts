import { describe, expect, it } from 'vitest'
import { byPaymentStatus, normalizeText, paymentStatus, rollForward } from './schedule'

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
