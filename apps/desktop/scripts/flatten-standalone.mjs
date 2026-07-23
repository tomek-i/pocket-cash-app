// Make the Next.js `output: 'standalone'` bundle self-contained and packageable.
//
// Why this exists: this is a pnpm monorepo, so the standalone bundle Next emits
// resolves its dependencies through pnpm's symlink store (node_modules/.pnpm).
// The app-level entry links (e.g. apps/web/node_modules/next) even point at
// ABSOLUTE paths inside THIS repo. That works when run from the repo, but the
// moment electron-builder / the NSIS installer copies the files out, the symlinks
// are dereferenced and `next` loses sight of its siblings (styled-jsx, etc.) →
// "Cannot find module 'styled-jsx/package.json'" and the server never boots.
//
// This script rewrites the bundle's node_modules into a FLAT tree of REAL files
// (npm-style: every package a top-level sibling, zero symlinks), so Node resolves
// everything by walking up physical directories and nothing breaks when copied.
// It also overlays the complete @electric-sql/pglite, whose dynamically-imported
// dist/contrib/*.js files Next never traces (it's a serverExternalPackage).
//
// Runs in the desktop build between `next build` and `electron-builder`.

import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, '../../..') // apps/desktop/scripts → repo root
const standalone = resolve(repo, 'apps/web/.next/standalone')
const pnpmDir = join(standalone, 'node_modules/.pnpm')
const appNm = join(standalone, 'apps/web/node_modules')

if (!readdirSync(standalone, { withFileTypes: true }).length) {
  throw new Error(`standalone bundle missing at ${standalone} — run \`next build\` first`)
}

// 1. Collect every real (non-symlink) package from the pnpm virtual store. Each
//    store entry `<pkg>@<ver>_<peers>/node_modules/` holds the real package plus
//    symlinks to its own deps; we take only the real dirs. Scoped packages nest
//    one level (@scope/name).
const firstSource = new Map() // pkgName -> src dir chosen (first wins)
const conflicts = new Map() // pkgName -> count of distinct versions seen

function consider(name, src) {
  if (firstSource.has(name)) {
    if (firstSource.get(name) !== src) conflicts.set(name, (conflicts.get(name) ?? 1) + 1)
    return
  }
  firstSource.set(name, src)
}

function collectFrom(nmDir) {
  let entries
  try {
    entries = readdirSync(nmDir, { withFileTypes: true })
  } catch {
    return
  }
  for (const e of entries) {
    if (e.name === '.bin') continue
    const full = join(nmDir, e.name)
    if (e.name.startsWith('@')) {
      let scoped
      try {
        scoped = readdirSync(full, { withFileTypes: true })
      } catch {
        continue
      }
      for (const s of scoped) {
        const sfull = join(full, s.name)
        if (!lstatSync(sfull).isSymbolicLink()) consider(`${e.name}/${s.name}`, sfull)
      }
    } else if (!lstatSync(full).isSymbolicLink()) {
      consider(e.name, full)
    }
  }
}

for (const entry of readdirSync(pnpmDir, { withFileTypes: true })) {
  if (entry.isDirectory() && entry.name !== 'node_modules') {
    collectFrom(join(pnpmDir, entry.name, 'node_modules'))
  }
}

// 2. Build the flat tree in a staging dir, then swap it in as apps/web/node_modules.
const staging = join(standalone, 'apps/web/node_modules__flat')
rmSync(staging, { recursive: true, force: true })
mkdirSync(staging, { recursive: true })
for (const [name, src] of firstSource) {
  const dest = join(staging, name)
  mkdirSync(resolve(dest, '..'), { recursive: true })
  cpSync(src, dest, { recursive: true, dereference: true })
}
rmSync(appNm, { recursive: true, force: true })
cpSync(staging, appNm, { recursive: true })
rmSync(staging, { recursive: true, force: true })

// 3. Overlay the COMPLETE @electric-sql/pglite (its dist/contrib/*.js are loaded
//    dynamically via import.meta.url and aren't traced into the standalone).
const pgliteDest = join(appNm, '@electric-sql/pglite')
rmSync(pgliteDest, { recursive: true, force: true })
// pnpm does not hoist @electric-sql/pglite to the repo root; it's symlinked into
// apps/web (its declaring package). Prefer that location, and fall back to a
// hoisted root node_modules for setups that do hoist. (dereference copies the
// real files behind the symlink.)
const pgliteSrc = [
  resolve(repo, 'apps/web/node_modules/@electric-sql/pglite'),
  resolve(repo, 'node_modules/@electric-sql/pglite'),
].find((p) => existsSync(p))
if (!pgliteSrc) {
  throw new Error('flatten-standalone: could not locate @electric-sql/pglite to overlay')
}
cpSync(pgliteSrc, pgliteDest, { recursive: true, dereference: true })

// 4. Drop the now-redundant symlinked pnpm store so no symlinks get packaged.
rmSync(join(standalone, 'node_modules'), { recursive: true, force: true })

console.log(
  `flatten-standalone: ${firstSource.size} packages flattened, pglite overlaid, .pnpm store removed`,
)
if (conflicts.size) {
  console.log(
    `flatten-standalone: NOTE multiple versions collapsed (first-wins, build-time only): ${[...conflicts.keys()].join(', ')}`,
  )
}
