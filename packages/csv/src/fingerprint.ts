import type { DedupeField, DedupeStrategy } from './config'
import type { CanonicalTransaction } from './parse'

/**
 * Stable dedup fingerprint for a transaction within an account, hashed to a
 * fixed-length hex string — fixed length keeps the `unique(account_id,
 * fingerprint)` btree index small and avoids Postgres' index-row size limit on
 * long descriptions.
 *
 * Default strategy is 'fullRow': every raw CSV column feeds the hash, so any
 * differing column (notably the running `balance`) keeps genuinely distinct rows
 * apart — e.g. two same-day, same-amount coffees. Re-importing the identical file
 * stays idempotent because byte-identical rows hash the same. The 'fields'
 * strategy hashes only selected canonical fields (see config.ts).
 */
const SEP = '␟' // unit separator — won't appear in real data

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function fingerprint(
  txn: CanonicalTransaction,
  options: { accountId: string; strategy?: DedupeStrategy; fields?: DedupeField[] },
): string {
  if (options.strategy === 'fields') {
    return fingerprintFields(txn, options.accountId, options.fields ?? DEFAULT_FIELDS)
  }
  return fingerprintFullRow(txn, options.accountId)
}

const DEFAULT_FIELDS: DedupeField[] = ['date', 'amount', 'description', 'reference']

/** Hash every raw CSV column (key-sorted for stable order). */
function fingerprintFullRow(txn: CanonicalTransaction, accountId: string): string {
  const parts: string[] = [accountId]
  for (const key of Object.keys(txn.rawData).sort()) {
    // Trim only — preserve case/content so distinct rows stay distinct, but
    // ignore incidental surrounding whitespace between exports.
    parts.push(`${key}=${(txn.rawData[key] ?? '').trim()}`)
  }
  return hash(parts.join(SEP))
}

/** Hash only the selected canonical fields (fuzzier; opt-in). */
function fingerprintFields(
  txn: CanonicalTransaction,
  accountId: string,
  fields: DedupeField[],
): string {
  const parts: string[] = [accountId]
  for (const field of fields) {
    let v = ''
    if (field === 'date') v = txn.date
    else if (field === 'amount') v = String(txn.amount)
    else if (field === 'description') v = normalize(txn.description)
    else if (field === 'reference') v = txn.reference ? normalize(txn.reference) : ''
    else if (field === 'balance') v = txn.balance != null ? String(txn.balance) : ''
    parts.push(`${field}=${v}`)
  }
  return hash(parts.join(SEP))
}

/** cyrb53-style 64-bit hash → 16-char hex. Deterministic, fast, dependency-free. */
function hash(str: string): string {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507)
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507)
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  const hi = (h2 >>> 0).toString(16).padStart(8, '0')
  const lo = (h1 >>> 0).toString(16).padStart(8, '0')
  return hi + lo
}
