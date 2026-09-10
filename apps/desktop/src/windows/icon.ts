import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { logStartup } from '../logging'

/**
 * The window icon.
 *
 * electron-builder brands the packaged *executable* from `build/icon.png`, but
 * that never reaches `BrowserWindow`, which defaults to Electron's own logo
 * unless it is given one. That is why the app showed the Electron icon: the
 * packaging side was configured, the runtime side was never asked.
 *
 * Where it matters:
 *
 * - **Dev** always, since there is no packaged exe to inherit an icon from.
 * - **Linux**, where the window manager reads the window's own icon.
 * - **Windows**, for the window itself; the taskbar entry of a packaged build
 *   follows the exe, so that part already worked.
 * - macOS ignores it entirely and uses the bundle icon.
 *
 * Candidates run best-first: the square 1024px master that `prepare-icon.mjs`
 * generates, then the web app's logo as a last resort. The logo is not square,
 * so it is only a fallback; an icon is better slightly letterboxed than absent.
 */
function candidates(): string[] {
  return [
    // Packaged: shipped via extraResources (see electron-builder.yml).
    join(process.resourcesPath ?? '', 'icon.png'),
    // Dev: dist/main.cjs → apps/desktop/build/icon.png, written by prepare-icon.
    join(__dirname, '..', 'build', 'icon.png'),
    // Packaged fallback: apps/web/public → resources/web/apps/web/public.
    join(process.resourcesPath ?? '', 'web', 'apps', 'web', 'public', 'logo.png'),
    // Dev fallback: dist/main.cjs → up to apps/ → web/public.
    join(__dirname, '..', '..', 'web', 'public', 'logo.png'),
  ]
}

let resolved: string | undefined
let looked = false

/** The first icon that exists on disk, or undefined to leave Electron's default. */
export function appIcon(): string | undefined {
  if (looked) return resolved
  looked = true

  for (const path of candidates()) {
    try {
      if (existsSync(path)) {
        resolved = path
        logStartup(`app icon: ${path}`)
        return resolved
      }
    } catch {
      // Unreadable path — try the next candidate.
    }
  }

  // Not fatal: the app runs fine wearing Electron's logo, and saying so beats a
  // silent fallback that looks like the fix never landed.
  logStartup('no app icon found; using the Electron default')
  return undefined
}
