'use client'

import {
  type ColumnRef,
  type CsvMappingConfig,
  csvMappingConfigSchema,
  detectDelimiter,
  parseCsv,
  tokenizeCsv,
} from '@repo/csv'
import {
  Badge,
  Button,
  buttonVariants,
  Card,
  CardContent,
  cn,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui'
import { CheckCircle2, FileUp, Upload } from 'lucide-react'
import Link from 'next/link'
import { type ReactNode, useMemo, useState, useTransition } from 'react'
import { type ImportResult, runImport, type SavedMapping, saveMapping } from '../actions'

interface AccountLite {
  id: string
  name: string
  currency: string
}

const DELIMITERS = [
  { value: ',', label: 'Comma  ,' },
  { value: ';', label: 'Semicolon  ;' },
  { value: '\t', label: 'Tab' },
  { value: '|', label: 'Pipe  |' },
]

/** Number of raw rows shown in the file preview (counted from the top of the file). */
const RAW_PREVIEW_ROWS = 6

function delimiterLabel(value: string): string {
  return value === '\t' ? 'Tab' : value === ' ' ? 'Space' : value
}

/** A sensible default mapping name derived from the uploaded file name. */
function suggestMappingName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '').trim() || 'Imported mapping'
}

function guess(headers: string[], re: RegExp): string {
  return headers.find((h) => re.test(h)) ?? ''
}

function buildDefaultConfig(
  headers: string[],
  delimiter: string,
  currency: string,
): CsvMappingConfig {
  return csvMappingConfigSchema.parse({
    minorUnitDigits: 2,
    currency,
    file: { delimiter, quote: '"', hasHeader: true, skipRows: 0 },
    fields: {
      date: {
        column: guess(headers, /date|datum|posted|booking/i) || headers[0] || '',
        format: 'DD/MM/YYYY',
      },
      description: {
        columns: [
          guess(headers, /desc|narrative|details|memo|payee|name/i) ||
            headers[1] ||
            headers[0] ||
            '',
        ],
      },
      amount: {
        mode: 'single',
        column: guess(headers, /amount|value|betrag/i) || '',
        decimal: '.',
        thousands: '',
        parensNegative: false,
        flipSign: false,
      },
      ...(guess(headers, /reference|ref|txn|transaction id/i)
        ? { reference: { column: guess(headers, /reference|ref|txn|transaction id/i) } }
        : {}),
      ...(guess(headers, /balance|saldo/i)
        ? { balance: { column: guess(headers, /balance|saldo/i) } }
        : {}),
    },
  })
}

export function ImportWizard({
  bankId,
  account,
  savedMappings,
}: {
  bankId: string
  account: AccountLite
  savedMappings: SavedMapping[]
}) {
  // The saved mapping applied by default — the bank's default, else the first.
  const defaultMapping = savedMappings.find((m) => m.isDefault) ?? savedMappings[0]

  const [fileText, setFileText] = useState('')
  const [fileName, setFileName] = useState('')
  const [config, setConfig] = useState<CsvMappingConfig | null>(null)
  // Preselected before any upload so the chooser shows what will be applied.
  const [mappingId, setMappingId] = useState<string | undefined>(defaultMapping?.id)
  const [mappingName, setMappingName] = useState(defaultMapping?.name ?? '')
  const [isDefault, setIsDefault] = useState(defaultMapping?.isDefault ?? false)
  const [notice, setNotice] = useState<string | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [pending, startTransition] = useTransition()

  // Update config immutably via a structured-clone draft.
  const update = (fn: (draft: CsvMappingConfig) => void) =>
    setConfig((current) => {
      if (!current) return current
      const draft = structuredClone(current)
      fn(draft)
      return draft
    })

  // Build a fresh config by detecting columns from the file. Pre-fills a mapping
  // name (from the file) so the config can always be saved — including on import.
  function buildFresh(text: string, suggestedName: string) {
    const delimiter = detectDelimiter(text)
    const rows = tokenizeCsv(text, { delimiter, quote: '"' })
    const headers = (rows[0] ?? []).map((h) => h.trim())
    setConfig(buildDefaultConfig(headers, delimiter, account.currency))
    setMappingId(undefined)
    setMappingName(suggestedName)
    setIsDefault(false)
  }

  // Apply a saved mapping (by id) to the file, or build a fresh detected config
  // when there's no matching saved mapping ('new' / undefined).
  function applyChoice(text: string, choice: string | undefined, suggestedName: string) {
    const saved = choice ? savedMappings.find((m) => m.id === choice) : undefined
    if (saved) {
      setConfig(csvMappingConfigSchema.parse(saved.config))
      setMappingId(saved.id)
      setMappingName(saved.name)
      setIsDefault(saved.isDefault)
    } else {
      buildFresh(text, suggestedName)
    }
  }

  async function onFile(file: File) {
    const text = await file.text()
    setFileText(text)
    setFileName(file.name)
    setResult(null)
    setNotice(null)
    // Honor whatever the user picked in the chooser (defaults to the saved mapping).
    applyChoice(text, mappingId, suggestMappingName(file.name))
  }

  // Switch mappings after a file is loaded. 'new' rebuilds a detected config.
  function selectMapping(choice: string) {
    if (choice === 'new') buildFresh(fileText, suggestMappingName(fileName))
    else applyChoice(fileText, choice, suggestMappingName(fileName))
  }

  // Save/update the mapping, then run the import — so configuring and clicking
  // Import never silently discards the mapping (a common mistake when the
  // separate Save step is skipped).
  function importTransactions() {
    if (!config) return
    startTransition(async () => {
      setNotice(null)
      const name = mappingName.trim() || suggestMappingName(fileName)
      const saved = await saveMapping({ bankId, mappingId, name, isDefault, config })
      if ('error' in saved) {
        setNotice(`Couldn't save mapping: ${saved.error}`)
        return
      }
      setMappingId(saved.id)
      setMappingName(name)
      const res = await runImport({ bankId, accountId: account.id, fileName, config, fileText })
      if (res.error) setNotice(res.error)
      else if (res.result) setResult(res.result)
    })
  }

  // Column options recomputed from the file using current file options.
  const headers = useMemo(() => {
    if (!fileText || !config) return []
    const rows = tokenizeCsv(fileText, {
      delimiter: config.file.delimiter,
      quote: config.file.quote,
    })
    const body = rows.slice(config.file.skipRows)
    const first = body[0] ?? []
    return config.file.hasHeader ? first.map((h) => h.trim()) : first.map((_, i) => String(i))
  }, [fileText, config])

  const preview = useMemo(
    () => (fileText && config ? parseCsv(fileText, config) : null),
    [fileText, config],
  )

  // Raw rows from the top of the file, tokenized with the current delimiter — lets
  // the user sanity-check delimiter / skip rows / header before mapping columns.
  const rawRows = useMemo(() => {
    if (!fileText || !config) return []
    return tokenizeCsv(fileText, {
      delimiter: config.file.delimiter,
      quote: config.file.quote,
    }).slice(0, RAW_PREVIEW_ROWS)
  }, [fileText, config])
  const rawColCount = rawRows.reduce((max, row) => Math.max(max, row.length), 0)
  // Positional ids (rows/columns are identified by index) so list keys are stable.
  const rawColumns = Array.from({ length: rawColCount }, (_, i) => ({ id: `col-${i}`, index: i }))
  const rawDisplayRows = rawRows.map((cells, i) => ({ id: `row-${i}`, index: i, cells }))

  if (!config) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 p-12 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <FileUp className="size-6" />
          </div>
          <div>
            <p className="font-medium">Upload a CSV statement</p>
            <p className="text-muted-foreground text-sm">
              {savedMappings.length > 0
                ? 'Your saved mapping is applied automatically — tweak it or start fresh after uploading.'
                : "We'll detect the columns and let you map them."}
            </p>
          </div>

          {savedMappings.length > 0 ? (
            <div className="flex w-full max-w-xs flex-col gap-1.5 text-left">
              <Label className="text-muted-foreground text-xs">Mapping to apply</Label>
              <Select
                value={mappingId ?? 'new'}
                onValueChange={(v) => setMappingId(!v || v === 'new' ? undefined : v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">New mapping (detect columns)</SelectItem>
                  {savedMappings.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                      {m.isDefault ? ' (default)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <FilePicker onFile={onFile} />
        </CardContent>
      </Card>
    )
  }

  const amount = config.fields.amount
  const hasHeader = config.file.hasHeader

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <FileUp className="size-4" />
          {fileName}
        </div>
        <div className="flex items-center gap-2">
          {savedMappings.length > 0 ? (
            <Select
              value={mappingId ?? 'new'}
              onValueChange={(v) => {
                if (v) selectMapping(v)
              }}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Load a mapping" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">New mapping</SelectItem>
                {savedMappings.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                    {m.isDefault ? ' (default)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          <FilePicker onFile={onFile} label="Change file" variant="outline" />
        </div>
      </div>

      {/* Raw file preview — reflects the current delimiter/quote so column splits
          are visible while configuring. Skipped rows are dimmed; the header row
          (when enabled) is highlighted. */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium text-sm">File preview</p>
            <p className="text-muted-foreground text-xs">
              First {rawRows.length} rows · {rawColCount} columns · delimiter “
              {delimiterLabel(config.file.delimiter)}”
            </p>
          </div>
          <div className="overflow-auto rounded-md border">
            <table className="w-full text-xs">
              <thead className="bg-muted text-muted-foreground">
                <tr>
                  <th className="w-8 p-2 text-right font-medium">#</th>
                  {rawColumns.map((col) => (
                    <th key={col.id} className="whitespace-nowrap p-2 text-left font-medium">
                      Col {col.index + 1}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rawDisplayRows.map((row) => {
                  const skipped = row.index < config.file.skipRows
                  const isHeader = config.file.hasHeader && row.index === config.file.skipRows
                  return (
                    <tr
                      key={row.id}
                      className={cn(
                        'border-t',
                        skipped && 'text-muted-foreground/50 line-through',
                        isHeader && 'bg-primary/5 font-medium',
                      )}
                    >
                      <td className="p-2 text-right text-muted-foreground tabular-nums">
                        {row.index + 1}
                      </td>
                      {rawColumns.map((col) => (
                        <td key={col.id} className="max-w-[14rem] truncate p-2">
                          {row.cells[col.index] ?? ''}
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Mapping config */}
        <Card>
          <CardContent className="flex flex-col gap-5 p-5">
            <section className="grid gap-3 sm:grid-cols-3">
              <LabeledControl label="Delimiter">
                <Select
                  value={config.file.delimiter}
                  onValueChange={(v) =>
                    update((d) => {
                      d.file.delimiter = v ?? ''
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DELIMITERS.map((d) => (
                      <SelectItem key={d.value} value={d.value}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </LabeledControl>
              <LabeledControl label="Skip rows">
                <Input
                  type="number"
                  min={0}
                  value={config.file.skipRows}
                  onChange={(e) =>
                    update((d) => {
                      d.file.skipRows = Math.max(0, Number(e.target.value) || 0)
                    })
                  }
                />
              </LabeledControl>
              <label className="flex items-end gap-2 pb-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={config.file.hasHeader}
                  onChange={(e) =>
                    update((d) => {
                      d.file.hasHeader = e.target.checked
                    })
                  }
                />
                Header row
              </label>
            </section>

            <Separator />

            <ColumnField
              label="Date column"
              value={config.fields.date.column}
              headers={headers}
              hasHeader={hasHeader}
              onChange={(r) =>
                update((d) => {
                  if (r !== undefined) d.fields.date.column = r
                })
              }
            />
            <LabeledControl label="Date format">
              <Input
                value={config.fields.date.format}
                placeholder="DD/MM/YYYY"
                onChange={(e) =>
                  update((d) => {
                    d.fields.date.format = e.target.value
                  })
                }
              />
            </LabeledControl>

            <ColumnField
              label="Description column"
              value={config.fields.description.columns[0]}
              headers={headers}
              hasHeader={hasHeader}
              onChange={(r) =>
                update((d) => {
                  if (r !== undefined) d.fields.description.columns = [r]
                })
              }
            />

            <Separator />

            {/* Amount */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Label className="text-muted-foreground">Amount</Label>
                <div className="ml-auto flex gap-1 rounded-md bg-muted p-0.5">
                  {(['single', 'split'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setAmountMode(update, headers, mode)}
                      className={cn(
                        'rounded px-2.5 py-1 text-xs capitalize transition-colors',
                        amount.mode === mode
                          ? 'bg-card text-foreground shadow-sm'
                          : 'text-muted-foreground',
                      )}
                    >
                      {mode === 'single' ? 'Single column' : 'Debit / Credit'}
                    </button>
                  ))}
                </div>
              </div>

              {amount.mode === 'single' ? (
                <ColumnField
                  label="Amount column"
                  value={amount.column}
                  headers={headers}
                  hasHeader={hasHeader}
                  onChange={(r) =>
                    update((d) => {
                      if (d.fields.amount.mode === 'single' && r !== undefined)
                        d.fields.amount.column = r
                    })
                  }
                />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <ColumnField
                    label="Debit (out)"
                    value={amount.debitColumn}
                    headers={headers}
                    hasHeader={hasHeader}
                    onChange={(r) =>
                      update((d) => {
                        if (d.fields.amount.mode === 'split' && r !== undefined)
                          d.fields.amount.debitColumn = r
                      })
                    }
                  />
                  <ColumnField
                    label="Credit (in)"
                    value={amount.creditColumn}
                    headers={headers}
                    hasHeader={hasHeader}
                    onChange={(r) =>
                      update((d) => {
                        if (d.fields.amount.mode === 'split' && r !== undefined)
                          d.fields.amount.creditColumn = r
                      })
                    }
                  />
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <LabeledControl label="Decimal separator">
                  <Select
                    value={amount.decimal}
                    onValueChange={(v) =>
                      update((d) => {
                        d.fields.amount.decimal = v ?? ''
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value=".">Dot .</SelectItem>
                      <SelectItem value=",">Comma ,</SelectItem>
                    </SelectContent>
                  </Select>
                </LabeledControl>
                <LabeledControl label="Thousands separator">
                  <Select
                    value={amount.thousands || 'none'}
                    onValueChange={(v) =>
                      update((d) => {
                        d.fields.amount.thousands =
                          !v || v === 'none' ? '' : v === 'space' ? ' ' : v
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value=",">Comma ,</SelectItem>
                      <SelectItem value=".">Dot .</SelectItem>
                      <SelectItem value="space">Space</SelectItem>
                    </SelectContent>
                  </Select>
                </LabeledControl>
              </div>

              <div className="flex flex-wrap gap-4 text-sm">
                {amount.mode === 'single' ? (
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={amount.parensNegative}
                      onChange={(e) =>
                        update((d) => {
                          if (d.fields.amount.mode === 'single')
                            d.fields.amount.parensNegative = e.target.checked
                        })
                      }
                    />
                    (1.23) is negative
                  </label>
                ) : null}
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    checked={amount.flipSign}
                    onChange={(e) =>
                      update((d) => {
                        d.fields.amount.flipSign = e.target.checked
                      })
                    }
                  />
                  Flip sign
                </label>
              </div>
            </div>

            <Separator />

            <div className="grid gap-3 sm:grid-cols-2">
              <ColumnField
                label="Reference (optional)"
                value={config.fields.reference?.column}
                headers={headers}
                hasHeader={hasHeader}
                allowNone
                onChange={(r) => update((d) => setOptional(d, 'reference', r))}
              />
              <ColumnField
                label="Balance (optional)"
                value={config.fields.balance?.column}
                headers={headers}
                hasHeader={hasHeader}
                allowNone
                onChange={(r) => update((d) => setOptional(d, 'balance', r))}
              />
            </div>

            <Separator />

            <LabeledControl label="Duplicate detection">
              <Select
                value={config.dedupe.strategy}
                onValueChange={(v) =>
                  update((d) => {
                    if (v === 'fullRow' || v === 'fields') d.dedupe.strategy = v
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fullRow">Whole row (recommended)</SelectItem>
                  <SelectItem value="fields">Key fields only</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">
                {config.dedupe.strategy === 'fullRow'
                  ? 'Two rows are duplicates only if every column matches — so same-day, same-amount transactions with a different running balance are kept.'
                  : 'Matches on date, amount, description and reference only — can wrongly flag distinct rows that look alike.'}
              </p>
            </LabeledControl>
          </CardContent>
        </Card>

        {/* Live preview */}
        <Card>
          <CardContent className="flex flex-col gap-3 p-5">
            <div className="flex items-center justify-between">
              <p className="font-medium text-sm">Preview</p>
              {preview ? (
                <div className="flex items-center gap-2 text-xs">
                  <Badge variant="success">{preview.okCount} ok</Badge>
                  {preview.errorCount > 0 ? (
                    <Badge variant="destructive">{preview.errorCount} errors</Badge>
                  ) : null}
                </div>
              ) : null}
            </div>

            {preview?.problems.length ? (
              <p className="rounded-md bg-destructive/10 p-2 text-destructive text-xs">
                {preview.problems.join(' · ')}
              </p>
            ) : null}

            <div className="max-h-[28rem] overflow-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted text-muted-foreground">
                  <tr>
                    <th className="p-2 text-left font-medium">Date</th>
                    <th className="p-2 text-left font-medium">Description</th>
                    <th className="p-2 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {preview?.rows.slice(0, 50).map((row) => (
                    <tr key={row.index} className="border-t">
                      {row.transaction ? (
                        <>
                          <td className="whitespace-nowrap p-2 text-muted-foreground text-xs">
                            {row.transaction.date}
                          </td>
                          <td className="max-w-[14rem] truncate p-2">
                            {row.transaction.description}
                          </td>
                          <td
                            className={cn(
                              'whitespace-nowrap p-2 text-right tabular-nums',
                              row.transaction.amount >= 0 ? 'text-success' : 'text-destructive',
                            )}
                          >
                            {formatMinor(row.transaction.amount, config.minorUnitDigits)}
                          </td>
                        </>
                      ) : (
                        <td colSpan={3} className="p-2 text-destructive text-xs">
                          Row {row.index + 1}: {row.errors.join(', ')}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Footer: save mapping + import */}
      <Card>
        <CardContent className="flex flex-col gap-4 p-5">
          {result ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <CheckCircle2 className="size-8 text-success" />
              <div>
                <p className="font-medium">Import complete</p>
                <p className="text-muted-foreground text-sm">
                  {result.imported} imported · {result.skipped} skipped (duplicates) ·{' '}
                  {result.errors} errors of {result.total} rows.
                </p>
              </div>
              <div className="flex gap-2">
                <Link href={`/app/banks/${bankId}`}>
                  <Button variant="outline">Back to bank</Button>
                </Link>
                <Button onClick={() => setResult(null)}>Import another file</Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-end">
                  <LabeledControl label="Mapping name" className="sm:w-56">
                    <Input
                      value={mappingName}
                      placeholder="e.g. Barclays CSV"
                      onChange={(e) => setMappingName(e.target.value)}
                    />
                  </LabeledControl>
                  <label className="flex items-center gap-2 pb-2 text-sm">
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={isDefault}
                      onChange={(e) => setIsDefault(e.target.checked)}
                    />
                    Default for this bank
                  </label>
                  <Button
                    variant="outline"
                    disabled={pending || !mappingName.trim()}
                    onClick={() =>
                      startTransition(async () => {
                        setNotice(null)
                        const res = await saveMapping({
                          bankId,
                          mappingId,
                          name: mappingName,
                          isDefault,
                          config,
                        })
                        if ('error' in res) setNotice(res.error)
                        else {
                          setMappingId(res.id)
                          setNotice('Mapping saved.')
                        }
                      })
                    }
                  >
                    Save mapping
                  </Button>
                </div>
                <Button
                  disabled={pending || !preview || preview.okCount === 0}
                  onClick={importTransactions}
                >
                  <Upload className="size-4" />
                  {pending ? 'Importing…' : `Import ${preview?.okCount ?? 0} transactions`}
                </Button>
              </div>
              <p className="text-muted-foreground text-xs">
                Importing also saves this mapping
                {mappingName.trim() ? ` as “${mappingName.trim()}”` : ''}, so your column setup is
                kept for next time.
              </p>
            </>
          )}
          {notice ? <p className="text-muted-foreground text-sm">{notice}</p> : null}
        </CardContent>
      </Card>
    </div>
  )
}

// ── helpers / small components ───────────────────────────────────────────────

function Separator() {
  return <div className="h-px w-full bg-border" />
}

function LabeledControl({
  label,
  className,
  children,
}: {
  label: string
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn('grid gap-1.5', className)}>
      <Label className="text-muted-foreground text-xs">{label}</Label>
      {children}
    </div>
  )
}

function ColumnField({
  label,
  value,
  headers,
  hasHeader,
  allowNone,
  onChange,
}: {
  label: string
  value: ColumnRef | undefined
  headers: string[]
  hasHeader: boolean
  allowNone?: boolean
  onChange: (ref: ColumnRef | undefined) => void
}) {
  const strValue = value === undefined ? 'none' : String(value)
  // Column identity is its position (header names can repeat), so the id is built
  // here rather than used directly as a React key.
  const options = headers.map((h, i) => ({
    id: `col-${i}`,
    value: hasHeader ? h : String(i),
    label: hasHeader ? h : `Column ${i + 1}`,
  }))
  return (
    <LabeledControl label={label}>
      <Select
        value={strValue}
        onValueChange={(v) => onChange(!v || v === 'none' ? undefined : hasHeader ? v : Number(v))}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select column" />
        </SelectTrigger>
        <SelectContent>
          {allowNone ? <SelectItem value="none">None</SelectItem> : null}
          {options.map((opt) => (
            <SelectItem key={opt.id} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </LabeledControl>
  )
}

function FilePicker({
  onFile,
  label = 'Choose CSV',
  variant = 'default',
}: {
  onFile: (file: File) => void
  label?: string
  variant?: 'default' | 'outline'
}) {
  return (
    <label className={cn(buttonVariants({ variant, size: 'sm' }), 'cursor-pointer gap-2')}>
      <Upload className="size-4" />
      {label}
      <input
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onFile(file)
          e.target.value = ''
        }}
      />
    </label>
  )
}

function setAmountMode(
  update: (fn: (d: CsvMappingConfig) => void) => void,
  headers: string[],
  mode: 'single' | 'split',
) {
  update((d) => {
    if (d.fields.amount.mode === mode) return
    const base = {
      decimal: d.fields.amount.decimal,
      thousands: d.fields.amount.thousands,
      flipSign: d.fields.amount.flipSign,
    }
    d.fields.amount =
      mode === 'single'
        ? { mode: 'single', column: headers[0] ?? '', parensNegative: false, ...base }
        : { mode: 'split', debitColumn: headers[0] ?? '', creditColumn: headers[1] ?? '', ...base }
  })
}

function setOptional(
  d: CsvMappingConfig,
  field: 'reference' | 'balance' | 'merchant',
  ref: ColumnRef | undefined,
) {
  if (ref === undefined) {
    delete d.fields[field]
  } else {
    d.fields[field] = { column: ref }
  }
}

function formatMinor(minor: number, digits: number): string {
  const sign = minor < 0 ? '-' : ''
  const abs = Math.abs(minor) / 10 ** digits
  return `${sign}${abs.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`
}
