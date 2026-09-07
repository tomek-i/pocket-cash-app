/**
 * Wrapper around `drizzle-kit generate` that insists on a migration name.
 *
 * Without `--name`, drizzle-kit invents one: `0001_lively_khan.sql`. That reads
 * as noise in the folder, in review and in `git log`, and nothing about it says
 * what the migration does. The failure is silent, so it is easy to only notice
 * once the file is committed.
 *
 * Usage: `pnpm db:generate --name=property` (or `--name property`).
 */

import { spawnSync } from 'node:child_process'

const args = process.argv.slice(2)

function readName() {
  const inline = args.find((arg) => arg.startsWith('--name='))
  if (inline) return inline.slice('--name='.length)

  const flag = args.indexOf('--name')
  if (flag !== -1) return args[flag + 1]

  return undefined
}

const name = readName()

if (!name) {
  console.error(
    [
      'A migration name is required.',
      '',
      '  pnpm db:generate --name=property',
      '',
      'Use snake_case describing what the migration does, e.g. "init",',
      '"property", "transaction_merchant". Without a name drizzle-kit picks a',
      'random one like "lively_khan", which tells a reviewer nothing.',
    ].join('\n'),
  )
  process.exit(1)
}

if (!/^[a-z][a-z0-9_]*$/.test(name)) {
  console.error(
    `Migration name "${name}" must be snake_case: lowercase letters, digits and underscores, starting with a letter.`,
  )
  process.exit(1)
}

const result = spawnSync('drizzle-kit', ['generate', `--name=${name}`], {
  stdio: 'inherit',
  shell: true,
})

process.exit(result.status ?? 1)
