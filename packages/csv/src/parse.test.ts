import { describe, expect, it } from 'vitest'
import { parseConfig } from './config'
import { parseCsv } from './parse'

describe('parseCsv — UK comma, single signed amount', () => {
  const csv = [
    'Date,Description,Amount,Balance,Reference',
    '24/06/2026,"ASTER COFFEE",-5.40,1234.56,TXN001',
    '21/06/2026,BRIGHT STUDIOS INVOICE 38,2400.00,3634.56,TXN002',
    'bad,ROW,xyz,,',
  ].join('\n')

  const config = parseConfig({
    minorUnitDigits: 2,
    currency: 'GBP',
    file: { delimiter: ',', hasHeader: true },
    fields: {
      date: { column: 'Date', format: 'DD/MM/YYYY' },
      description: { columns: ['Description'] },
      amount: { mode: 'single', column: 'Amount', decimal: '.', thousands: ',' },
      balance: { column: 'Balance' },
      reference: { column: 'Reference' },
    },
  })

  const result = parseCsv(csv, config)

  it('reports no structural problems', () => expect(result.problems).toEqual([]))

  it('counts 2 ok / 1 error', () => {
    expect(result.okCount).toBe(2)
    expect(result.errorCount).toBe(1)
  })

  it('normalises the first transaction', () => {
    const txn = result.rows[0]?.transaction
    expect(txn).toMatchObject({
      date: '2026-06-24',
      amount: -540,
      description: 'ASTER COFFEE',
      balance: 123456,
      reference: 'TXN001',
      currency: 'GBP',
    })
    expect(txn?.rawData.Reference).toBe('TXN001')
  })

  it('keeps income positive', () => {
    expect(result.rows[1]?.transaction?.amount).toBe(240000)
  })

  it('flags the malformed row with errors', () => {
    const row = result.rows[2]
    expect(row?.ok).toBe(false)
    expect(row?.errors.length).toBeGreaterThan(0)
  })
})

describe('parseCsv — European semicolon, split debit/credit', () => {
  const csv = [
    'Datum;Buchung;Verwendung;Soll;Haben;Saldo',
    '24.06.2026;Kaffee;REWE;5,40;;1.234,56',
    '21.06.2026;Gehalt;ACME GMBH;;2.400,00;3.634,56',
  ].join('\n')

  const config = parseConfig({
    currency: 'EUR',
    file: { delimiter: ';', hasHeader: true },
    fields: {
      date: { column: 'Datum', format: 'DD.MM.YYYY' },
      description: { columns: ['Buchung', 'Verwendung'], join: ' — ' },
      amount: {
        mode: 'split',
        debitColumn: 'Soll',
        creditColumn: 'Haben',
        decimal: ',',
        thousands: '.',
      },
      balance: { column: 'Saldo' },
    },
  })

  const result = parseCsv(csv, config)

  it('parses both rows', () => {
    expect(result.okCount).toBe(2)
    expect(result.problems).toEqual([])
  })

  it('debit row → negative, joined description, parsed balance', () => {
    expect(result.rows[0]?.transaction).toMatchObject({
      date: '2026-06-24',
      amount: -540,
      description: 'Kaffee — REWE',
      balance: 123456,
    })
  })

  it('credit row → positive', () => {
    expect(result.rows[1]?.transaction?.amount).toBe(240000)
  })
})

describe('parseCsv — headerless, columns by index', () => {
  const config = parseConfig({
    file: { delimiter: ',', hasHeader: false },
    fields: {
      date: { column: 0, format: 'YYYY-MM-DD' },
      description: { columns: [1] },
      amount: { mode: 'single', column: 2 },
    },
  })

  const result = parseCsv('2026-06-24,COFFEE,-5.40', config)

  it('maps by index and keys rawData by position', () => {
    expect(result.okCount).toBe(1)
    expect(result.rows[0]?.transaction).toMatchObject({
      date: '2026-06-24',
      amount: -540,
      description: 'COFFEE',
    })
    expect(result.rows[0]?.transaction?.rawData).toEqual({
      '0': '2026-06-24',
      '1': 'COFFEE',
      '2': '-5.40',
    })
  })
})

describe('parseCsv — missing mapped column', () => {
  const config = parseConfig({
    file: { delimiter: ',', hasHeader: true },
    fields: {
      date: { column: 'Date', format: 'YYYY-MM-DD' },
      description: { columns: ['Description'] },
      amount: { mode: 'single', column: 'Amount' },
    },
  })

  it('reports the missing column as a structural problem', () => {
    const result = parseCsv('Date,Description,Amt\n2026-06-24,x,-5.40', config)
    expect(result.problems).toContain('column "Amount" not found in header')
  })
})
