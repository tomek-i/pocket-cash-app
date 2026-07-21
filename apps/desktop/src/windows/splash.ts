import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { BrowserWindow } from 'electron'
import { logStartup } from '../logging'

// Load the app logo (the single source of truth — apps/web/public/logo.png) as a
// base64 data URI so it can be inlined into the self-contained splash. Tries the
// packaged resources location first, then the dev source tree. Returns null (→ the
// "PC" text fallback) if it isn't there, so the splash never depends on the file.
function loadLogoDataUri(): string | null {
  const candidates = [
    // Packaged: extraResources copies apps/web/public → resources/web/apps/web/public.
    join(process.resourcesPath, 'web', 'apps', 'web', 'public', 'logo.png'),
    // Dev: dist/main.cjs → up to apps/ → web/public.
    join(__dirname, '..', '..', 'web', 'public', 'logo.png'),
  ]
  for (const path of candidates) {
    try {
      if (!existsSync(path)) continue
      const bytes = readFileSync(path)
      // The splash is a data: URL; an oversized inline image can exceed Chromium's
      // navigation limit and break it. A logo has no business being this big —
      // fall back to the text tile and leave a breadcrumb instead.
      if (bytes.byteLength > 1_500_000) {
        logStartup(`splash logo skipped: ${path} is ${bytes.byteLength} bytes (>1.5MB)`)
        return null
      }
      return `data:image/png;base64,${bytes.toString('base64')}`
    } catch {
      // ignore — fall through to the next candidate / text fallback
    }
  }
  return null
}

// A tiny, fully self-contained splash. It's a data: URL — no server, no network —
// so it paints in the first frame while the in-process Next server + embedded
// database spin up behind it (a cold start also runs migrations, which can take a
// few seconds). Same dark canvas as the app to avoid any flash. The logo is
// inlined from disk (see loadLogoDataUri); absent it, a "PC" gradient tile stands
// in so branding is never load-bearing for startup.
function splashHtml(): string {
  const logo = loadLogoDataUri()
  const logoMarkup = logo
    ? `<img class="logo" src="${logo}" alt="">`
    : `<div class="logo logo-fallback">PC</div>`
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{height:100%}
  body{background:#0a0a08;color:#f6f6f0;overflow:hidden;
    font-family:-apple-system,"Segoe UI",Roboto,system-ui,sans-serif;
    display:flex;align-items:center;justify-content:center;
    -webkit-user-select:none;user-select:none}
  .wrap{display:flex;flex-direction:column;align-items:center;gap:18px}
  .logo{width:72px;height:72px;border-radius:18px;object-fit:contain;
    box-shadow:0 10px 34px rgba(229,229,46,.28)}
  .logo-fallback{color:#0a0a08;font-weight:700;font-size:26px;
    background:linear-gradient(140deg,#e5e52e,#c9c91f);
    display:flex;align-items:center;justify-content:center}
  .name{font-size:20px;font-weight:600;letter-spacing:-.01em}
  .bar{width:180px;height:3px;border-radius:3px;background:rgba(255,255,255,.08);overflow:hidden}
  .bar::after{content:"";display:block;height:100%;width:40%;border-radius:3px;
    background:linear-gradient(90deg,#e5e52e,#c9c91f);animation:slide 1.1s ease-in-out infinite}
  .status{font-size:13px;color:#a3a39a}
  @keyframes slide{0%{transform:translateX(-100%)}100%{transform:translateX(350%)}}
</style></head><body><div class="wrap">
  ${logoMarkup}
  <div class="name">Pocket Cash</div>
  <div class="bar"></div>
  <div class="status">Starting…</div>
</div></body></html>`
}

let splash: BrowserWindow | null = null

// Resolves once the splash is on screen WITH its content painted. We deliberately
// keep `show:false` and reveal on `ready-to-show` (which fires after the first
// paint) rather than `show:true`: showing immediately paints only the empty dark
// canvas, and the HTML doesn't appear until the main process frees up after the
// heavy server import blocks it for a few seconds — which looks like a broken,
// half-transparent splash. Awaiting this before that import guarantees the user
// sees a fully-rendered "Starting…" splash first.
export function createSplash(): Promise<void> {
  const win = new BrowserWindow({
    width: 460,
    height: 300,
    frame: false,
    resizable: false,
    center: true,
    show: false,
    backgroundColor: '#0a0a08',
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  })
  splash = win

  return new Promise<void>((resolve) => {
    let settled = false
    const reveal = () => {
      if (settled) return
      settled = true
      if (!win.isDestroyed()) win.show()
      resolve()
    }
    win.once('ready-to-show', reveal)
    // Fallback: a data URL paints in milliseconds, but never let a missed event
    // hang startup behind an invisible splash.
    setTimeout(reveal, 800)
    win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splashHtml())}`)
  })
}

export function closeSplash(): void {
  if (splash && !splash.isDestroyed()) splash.close()
  splash = null
}
