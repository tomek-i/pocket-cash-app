/**
 * Regression test for the transaction list order, against a real in-memory
 * PGlite database.
 *
 * The bug this pins down (#55): rows jumped around while you categorised them.
 * The cause was not the UI. A CSV import gives every row the same `created_at`,
 * so ordering by (date, created_at) alone left the list tied, and Postgres
 * returned tied rows in heap order, which an UPDATE changes. Nothing but a real
 * database reproduces that, hence the integration test.
 */

import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'
import { fuzzystrmatch } from '@electric-sql/pglite/contrib/fuzzystrmatch'
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm'
import { desc, eq, sql } from 'drizzle-orm'
import { drizzle, type PgliteDatabase } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { accounts, banks, categories, schema, transactions } from './schema'
import { transactionListOrder } from './transaction-order'

type TestDb = PgliteDatabase<typeof schema>

let client: PGlite
let db: TestDb
let categoryId: string

/** The descriptions of a whole day's rows, in the order the list would show them. */
const listed = (order: typeof transactionListOrder) =>
  db
    .select({ description: transactions.description })
    .from(transactions)
    .orderBy(...order)
    .then((rows) => rows.map((r) => r.description))

beforeAll(async () => {
  client = new PGlite('memory://', { extensions: { pg_trgm, fuzzystrmatch } })
  await client.waitReady
  db = drizzle(client, { schema })
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`)
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS fuzzystrmatch`)
  await migrate(db, {
    migrationsFolder: join(dirname(fileURLToPath(import.meta.url)), '../drizzle/migrations'),
  })

  const [bank] = await db.insert(banks).values({ name: 'Test Bank' }).returning({ id: banks.id })
  if (!bank) throw new Error('no bank')
  const [account] = await db
    .insert(accounts)
    .values({ bankId: bank.id, name: 'Everyday', currency: 'AUD', type: 'checking' })
    .returning({ id: accounts.id })
  if (!account) throw new Error('no account')
  const [category] = await db
    .insert(categories)
    .values({ name: 'Groceries' })
    .returning({ id: categories.id })
  if (!category) throw new Error('no category')
  categoryId = category.id

  // One import: same date, and `created_at` defaults to a single now() for the
  // whole statement, which is exactly what the CSV importer produces.
  await db.insert(transactions).values(
    ['A', 'B', 'C', 'D', 'E', 'F'].map((name, i) => ({
      accountId: account.id,
      date: '2026-09-01',
      description: name,
      amount: -1000 - i,
      currency: 'AUD',
      rawData: {},
      fingerprint: `fp-${name}`,
    })),
  )
}, 60_000)

afterAll(async () => {
  await client?.close()
})

describe('transactionListOrder', () => {
  it('leaves an import tied on date and created_at', async () => {
    const [row] = await db
      .select({ dates: sql<number>`count(distinct ${transactions.date})::int` })
      .from(transactions)
    expect(row?.dates).toBe(1)
    const [stamps] = await db
      .select({ created: sql<number>`count(distinct ${transactions.createdAt})::int` })
      .from(transactions)
    expect(stamps?.created).toBe(1)
  })

  it('keeps the order stable when a transaction is categorised', async () => {
    const before = await listed(transactionListOrder)

    for (const name of ['B', 'D', 'A']) {
      await db
        .update(transactions)
        .set({ categoryId, updatedAt: new Date() })
        .where(eq(transactions.description, name))
      expect(await listed(transactionListOrder)).toEqual(before)
    }
  })

  it('is the ordering that was unstable without the id tiebreaker', async () => {
    // Guards the reason `id` is in the list: drop it and the same updates that
    // the test above survives reshuffle the rows.
    const untied = [desc(transactions.date), desc(transactions.createdAt)]
    const before = await listed(untied)

    await db
      .update(transactions)
      .set({ categoryId: null, updatedAt: new Date() })
      .where(eq(transactions.description, 'B'))
    await db
      .update(transactions)
      .set({ categoryId, updatedAt: new Date() })
      .where(eq(transactions.description, 'E'))

    expect(await listed(untied)).not.toEqual(before)
    expect(await listed(untied)).toEqual(expect.arrayContaining(before))
  })
})
