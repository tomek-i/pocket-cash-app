// Derive the desktop app icon from the web app's single source-of-truth logo.
//
// Assets live in the web app (apps/web/public) — the desktop shell packages and
// runs the web build, so it depends on web, never the other way around. But the
// desktop icon is a BUILD-TIME packaging asset: electron-builder needs a real
// square PNG (>=256px) at its buildResources path (build/icon.png) to convert
// into the Windows .ico / mac .icns. So instead of editing two files, we copy the
// one master here, right before electron-builder runs. The copy is generated and
// git-ignored — apps/web/public/logo.png stays the only file you edit.
//
// Tolerant by design: if the master is missing we warn and continue, letting
// electron-builder fall back to its default icon rather than failing the build.

import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(scriptDir, '..', '..', '..')

const source = join(repoRoot, 'apps', 'web', 'public', 'logo.png')
const dest = join(scriptDir, '..', 'build', 'icon.png')

if (!existsSync(source)) {
  console.warn(
    `⚠️  [prepare-icon] No logo at ${source} — packaging with the default Electron icon.\n` +
      '   Drop a square PNG (>=256px, ideally 512-1024) there to brand the app.',
  )
  process.exit(0)
}

mkdirSync(dirname(dest), { recursive: true })
copyFileSync(source, dest)
console.log(`✅ [prepare-icon] ${source} → ${dest}`)
