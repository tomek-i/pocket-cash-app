import { parseSignedDecimal, parseSingleAmount, parseSplitAmount } from './amount'
import { type ColumnRef, type CsvMappingConfig, csvMappingConfigSchema } from './config'
import { parseDate } from './date'
import { tokenizeCsv } from './tokenize'

/**
 * A bank-agnostic transaction produced from one CSV row. `amount`/`balance` are
 * signed integer minor units. This is the shape the import action persists into
 * `transactions` (it then adds `accountId`, `currency` fallback, `fingerprint`,
 * `importId`).
 */
export interface CanonicalTransaction {
  date: string
  valueDate?: string
  description: string
  merchant?: string
  amount: number
  currency?: string
  balance?: number
  reference?: string
  rawData: Record<string, string>
}

export interface ParsedRow {
  /** 0-based index among data rows (after header/skipped rows). */
  index: number
  ok: boolean
  transaction?: CanonicalTransaction
  errors: string[]
}

export interface ParseResult {
  headers: string[] | null
  rows: ParsedRow[]
  okCount: number
  errorCount: number
  /** Structural problems (e.g. a mapped column missing from the header). */
  problems: string[]
}

/** Run an importer over raw CSV text. Never throws on bad data — each row either
 * yields a transaction or carries `errors`. Throws only on an invalid config. */
export function parseCsv(text: string, config: CsvMappingConfig): ParseResult {
  const cfg = csvMappingConfigSchema.parse(config)
  const { fields } = cfg
  const amount = fields.amount

  const all = tokenizeCsv(text, { delimiter: cfg.file.delimiter, quote: cfg.file.quote })
  const body = all.slice(cfg.file.skipRows)

  let headers: string[] | null = null
  let dataRows: string[][]
  if (cfg.file.hasHeader) {
    headers = (body[0] ?? []).map((h) => h.trim())
    dataRows = body.slice(1)
  } else {
    dataRows = body
  }

  const problems = collectColumnProblems(cfg, headers)

  const indexOf = (ref: ColumnRef): number => {
    if (typeof ref === 'number') return ref
    return headers ? headers.indexOf(ref) : -1
  }
  const cell = (row: string[], ref: ColumnRef): string => {
    const idx = indexOf(ref)
    if (idx < 0) return ''
    return (row[idx] ?? '').trim()
  }
  const buildRaw = (row: string[]): Record<string, string> => {
    const out: Record<string, string> = {}
    if (headers)
      headers.forEach((h, i) => {
        out[h] = row[i] ?? ''
      })
    else
      row.forEach((v, i) => {
        out[String(i)] = v
      })
    return out
  }

  const numFmt = {
    decimal: amount.decimal,
    thousands: amount.thousands,
    minorUnitDigits: cfg.minorUnitDigits,
  }

  const rows: ParsedRow[] = dataRows.map((row, index) => {
    const errors: string[] = []

    const rawDate = cell(row, fields.date.column)
    const date = parseDate(rawDate, fields.date.format)
    if (date === null) errors.push(`invalid date "${rawDate}"`)

    let value: number | null
    if (amount.mode === 'single') {
      value = parseSingleAmount(cell(row, amount.column), {
        ...numFmt,
        parensNegative: amount.parensNegative,
        flipSign: amount.flipSign,
      })
    } else {
      value = parseSplitAmount(cell(row, amount.debitColumn), cell(row, amount.creditColumn), {
        ...numFmt,
        parensNegative: false,
        flipSign: amount.flipSign,
      })
    }
    if (value === null) errors.push('missing or invalid amount')

    if (date === null || value === null) {
      return { index, ok: false, errors }
    }

    const description = fields.description.columns
      .map((c) => cell(row, c))
      .filter((s) => s.length > 0)
      .join(fields.description.join)

    const valueDate = fields.valueDate
      ? (parseDate(cell(row, fields.valueDate.column), fields.valueDate.format) ?? undefined)
      : undefined
    const merchant = fields.merchant ? cell(row, fields.merchant.column) || undefined : undefined
    const reference = fields.reference ? cell(row, fields.reference.column) || undefined : undefined
    const balance = fields.balance
      ? (parseSignedDecimal(cell(row, fields.balance.column), {
          ...numFmt,
          parensNegative: false,
        }) ?? undefined)
      : undefined

    const transaction: CanonicalTransaction = {
      date,
      amount: value,
      description,
      rawData: buildRaw(row),
      ...(valueDate !== undefined ? { valueDate } : {}),
      ...(merchant !== undefined ? { merchant } : {}),
      ...(reference !== undefined ? { reference } : {}),
      ...(balance !== undefined ? { balance } : {}),
      ...(cfg.currency !== undefined ? { currency: cfg.currency } : {}),
    }
    return { index, ok: true, transaction, errors }
  })

  const okCount = rows.filter((r) => r.ok).length
  return { headers, rows, okCount, errorCount: rows.length - okCount, problems }
}

function collectColumnProblems(cfg: CsvMappingConfig, headers: string[] | null): string[] {
  const refs: ColumnRef[] = [cfg.fields.date.column, ...cfg.fields.description.columns]
  if (cfg.fields.valueDate) refs.push(cfg.fields.valueDate.column)
  if (cfg.fields.merchant) refs.push(cfg.fields.merchant.column)
  if (cfg.fields.balance) refs.push(cfg.fields.balance.column)
  if (cfg.fields.reference) refs.push(cfg.fields.reference.column)
  if (cfg.fields.amount.mode === 'single') refs.push(cfg.fields.amount.column)
  else refs.push(cfg.fields.amount.debitColumn, cfg.fields.amount.creditColumn)

  const problems = new Set<string>()
  for (const ref of refs) {
    if (typeof ref !== 'string') continue
    if (!headers) problems.add(`column "${ref}" referenced but the file has no header row`)
    else if (!headers.includes(ref)) problems.add(`column "${ref}" not found in header`)
  }
  return [...problems]
}
