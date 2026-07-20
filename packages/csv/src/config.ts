import { z } from 'zod'

/**
 * `CsvMappingConfig` — the "importer" definition for one bank's CSV format. It is
 * pure data: how to tokenise the file and how each CSV column maps onto our
 * canonical transaction fields, plus the per-field transforms that absorb every
 * bank's quirks (date format, decimal/thousands separators, sign conventions,
 * single vs split debit/credit columns, multi-column descriptions).
 *
 * Stored as `csv_mappings.config` (jsonb). Validate untrusted input with
 * `csvMappingConfigSchema` / `parseConfig` before use.
 */

/** A CSV column, referenced by header name (with a header row) or 0-based index. */
const columnRef = z.union([z.string(), z.number().int().nonnegative()])
export type ColumnRef = z.infer<typeof columnRef>

const fileSchema = z.object({
  /** Single character: "," ";" "\t" "|". */
  delimiter: z.string().min(1).default(','),
  quote: z.string().min(1).default('"'),
  hasHeader: z.boolean().default(true),
  /** Preamble rows to drop before the header/data (some banks emit a banner). */
  skipRows: z.number().int().nonnegative().default(0),
  /** Metadata only — decoding happens at read time. */
  encoding: z.string().default('utf-8'),
})

const dateFieldSchema = z.object({
  column: columnRef,
  /** Tokens: YYYY, YY, MM, M, DD, D; everything else is a literal. e.g. "DD/MM/YYYY". */
  format: z.string().min(1),
})

const descriptionFieldSchema = z.object({
  /** One or more columns concatenated (skipping blanks) with `join`. */
  columns: z.array(columnRef).min(1),
  join: z.string().default(' '),
})

const simpleFieldSchema = z.object({ column: columnRef })

const numberFormatShape = {
  /** Decimal separator in the source ("." or ","). */
  decimal: z.string().default('.'),
  /** Thousands separator to strip ("," "." " " or "" for none). */
  thousands: z.string().default(''),
  /** Invert the final sign (banks that report spending as positive). */
  flipSign: z.boolean().default(false),
}

const amountSingleSchema = z.object({
  mode: z.literal('single'),
  column: columnRef,
  /** Treat "(123.45)" as negative. */
  parensNegative: z.boolean().default(false),
  ...numberFormatShape,
})

const amountSplitSchema = z.object({
  mode: z.literal('split'),
  /** Money out (becomes negative). */
  debitColumn: columnRef,
  /** Money in (becomes positive). */
  creditColumn: columnRef,
  ...numberFormatShape,
})

const amountSchema = z.discriminatedUnion('mode', [amountSingleSchema, amountSplitSchema])

export const csvMappingConfigSchema = z.object({
  version: z.literal(1).default(1),
  /** Minor-unit exponent for the account currency (2 = cents, 0 = JPY). */
  minorUnitDigits: z.number().int().min(0).max(4).default(2),
  /** Optional fallback currency code if the file carries no currency column. */
  currency: z.string().length(3).optional(),
  file: fileSchema.default({}),
  fields: z.object({
    date: dateFieldSchema,
    valueDate: dateFieldSchema.optional(),
    description: descriptionFieldSchema,
    merchant: simpleFieldSchema.optional(),
    amount: amountSchema,
    balance: simpleFieldSchema.optional(),
    reference: simpleFieldSchema.optional(),
  }),
  dedupe: z
    .object({
      /**
       * How a row's dedup fingerprint is built:
       *  - 'fullRow' (default): hash EVERY raw CSV column. Any differing column
       *    keeps genuinely distinct rows apart — e.g. two same-day, same-amount
       *    coffees that differ only by the running `balance` column. Re-importing
       *    the identical file is still idempotent (byte-identical rows collide).
       *  - 'fields': hash only the selected canonical fields below (fuzzier; can
       *    false-flag distinct rows that look alike). Kept for banks whose export
       *    adds a volatile per-row column that would defeat full-row matching.
       */
      strategy: z.enum(['fullRow', 'fields']).default('fullRow'),
      fields: z
        .array(z.enum(['date', 'amount', 'description', 'reference', 'balance']))
        .min(1)
        .default(['date', 'amount', 'description', 'reference']),
    })
    .default({}),
})

export type CsvMappingConfig = z.infer<typeof csvMappingConfigSchema>
export type DedupeField = CsvMappingConfig['dedupe']['fields'][number]
export type DedupeStrategy = CsvMappingConfig['dedupe']['strategy']

/** Validate + apply defaults to an untrusted config object. Throws on invalid. */
export function parseConfig(input: unknown): CsvMappingConfig {
  return csvMappingConfigSchema.parse(input)
}
