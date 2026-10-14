import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, describe, expect, it } from 'vitest'
import { listSnapshots, resolveSnapshot, snapshotsDir } from './snapshots'

const root = mkdtempSync(join(tmpdir(), 'pocket-cash-snapshots-'))
const dataDir = join(root, 'pglite')
const dir = `${dataDir}-snapshots`
mkdirSync(dir, { recursive: true })

const older = '2026-10-01T09-00-00-000Z--before-migration.tar.gz'
const newer = '2026-10-14T03-15-30-123Z--manual.tar.gz'
writeFileSync(join(dir, older), 'a')
writeFileSync(join(dir, newer), 'bb')
writeFileSync(join(dir, 'notes.txt'), 'not a snapshot')

afterAll(() => rmSync(root, { recursive: true, force: true }))

describe('snapshotsDir', () => {
  it('sits next to the data directory', () => {
    expect(snapshotsDir(dataDir)).toBe(dir)
  })

  it('has nothing to protect for an in-memory database', () => {
    expect(snapshotsDir('memory://')).toBeNull()
  })
})

describe('listSnapshots', () => {
  it('lists only snapshot files, newest first, with their reason and time', async () => {
    const list = await listSnapshots(dataDir)
    expect(list.map((s) => s.name)).toEqual([newer, older])
    expect(list[0]).toMatchObject({
      reason: 'manual',
      createdAt: '2026-10-14T03:15:30.123Z',
      bytes: 2,
    })
  })
})

describe('resolveSnapshot', () => {
  it('finds a snapshot by name', () => {
    expect(resolveSnapshot(older, dataDir)).toBe(join(dir, older))
  })

  it('refuses names that are not snapshots or point elsewhere', () => {
    expect(resolveSnapshot('notes.txt', dataDir)).toBeNull()
    expect(resolveSnapshot(`../${older}`, dataDir)).toBeNull()
    expect(resolveSnapshot('2026-10-02T09-00-00-000Z--manual.tar.gz', dataDir)).toBeNull()
  })
})

describe('PGlite data directory round trip', () => {
  it('restores a dumped database with its rows intact', async () => {
    const source = new PGlite('memory://')
    await source.exec(`CREATE TABLE notes (id int primary key, body text);
      INSERT INTO notes VALUES (1, 'kept');`)
    const tarball = await source.dumpDataDir('gzip')
    await source.close()

    const restored = new PGlite('memory://', { loadDataDir: tarball })
    const { rows } = await restored.query<{ body: string }>('SELECT body FROM notes WHERE id = 1')
    expect(rows[0]?.body).toBe('kept')
    await restored.close()
  }, 60_000)
})
