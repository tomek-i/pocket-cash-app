import Papa from 'papaparse'

/**
 * Tokenise CSV text into rows of string cells, delegating to PapaParse (the
 * battle-tested, isomorphic CSV parser) so quoting, escaped quotes, embedded
 * newlines, BOM, and CRLF are all handled correctly. `delimiter` and `quote` are
 * single characters. Blank lines (incl. a trailing newline) are dropped.
 */
export function tokenizeCsv(
  text: string,
  options: { delimiter: string; quote: string },
): string[][] {
  const result = Papa.parse<string[]>(text, {
    delimiter: options.delimiter,
    quoteChar: options.quote,
    header: false,
    skipEmptyLines: 'greedy',
  })
  return result.data
}

/**
 * Best-effort delimiter detection (`,` `;` `\t` `|`) for the import wizard's first
 * step. Returns the delimiter PapaParse inferred, defaulting to ",".
 */
export function detectDelimiter(text: string): string {
  const result = Papa.parse<string[]>(text, {
    header: false,
    skipEmptyLines: 'greedy',
    preview: 20,
  })
  return result.meta.delimiter || ','
}
