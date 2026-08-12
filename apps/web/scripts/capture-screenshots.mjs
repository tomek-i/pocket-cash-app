/**
 * Capture the product screenshots used by the README and the landing page.
 *
 * Run it against a RUNNING web app (the app must already be serving):
 *
 *   pnpm dev:web                        # terminal 1 — embedded PGlite
 *   pnpm --filter web screenshots       # terminal 2
 *
 * Env:
 *   BASE_URL   default http://localhost:3000 — point at the port dev:web actually
 *              picked (it falls back to 3001 if 3000 is taken).
 *   OUT_DIR    default <repo>/docs/assets
 *   NO_SEED=1  skip re-seeding (use whatever data is already in the database).
 *
 * Everything is deterministic on purpose: it re-seeds the demo dataset first, so
 * the shots always show the same populated app rather than whatever happened to
 * be in the dev database. Re-run it whenever the UI changes and commit the diff.
 */
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = join(HERE, '..', '..', '..')

const BASE_URL = (process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '')
const OUT_DIR = process.env.OUT_DIR ?? join(REPO, 'docs', 'assets')
const FIXTURE = join(HERE, 'fixtures', 'sample-statement.csv')

// A 16:10 desktop window. 1.5x keeps text crisp on HiDPI while staying small
// enough to commit: GitHub renders README images at roughly 890px wide, so 2160px
// is still ~2.4x oversampled. 2x looked identical in the README and cost ~40% more
// bytes for every screenshot, forever, in git history.
const VIEWPORT = { width: 1440, height: 900 }
const SCALE = 1.5

// Next's dev overlay floats a badge over the bottom-left of every page (and sits
// right on top of the sidebar's "Import CSV" button). It is dev-only chrome, not
// part of the product, so it must never appear in a marketing screenshot.
const HIDE_DEV_OVERLAY = 'nextjs-portal,[data-nextjs-dev-tools-button]{display:none !important}'

/**
 * The app reports by AUSTRALIAN financial year (1 Jul – 30 Jun) and names one by
 * its ending year. The demo dataset spans the last 12 months, so the PREVIOUS FY
 * is the one that is fully populated — the current FY only holds the weeks since
 * 1 July and makes for a thin-looking report.
 */
function previousFinancialYear(now) {
  const currentFy = now.getFullYear() + (now.getMonth() + 1 >= 7 ? 1 : 0)
  return currentFy - 1
}

/** Previous calendar month as `YYYY-MM`, for the dashboard's ?month= param. */
function previousMonthParam(now) {
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

async function settle(page) {
  await page.addStyleTag({ content: HIDE_DEV_OVERLAY }).catch(() => {})
  // Drop any focus ring left behind by a click, and make sure charts have painted.
  await page.evaluate(() => document.activeElement?.blur?.())
  await page.waitForTimeout(600)
}

async function shot(page, name) {
  await settle(page)
  const path = join(OUT_DIR, `${name}.png`)
  await page.screenshot({ path })
  console.log(`  ✓ ${name}.png`)
}

/**
 * Load the demo dataset through the real Settings UI (rather than poking the
 * database), so this exercises the same path a user takes and can't drift from it.
 */
async function seedDemoData(page) {
  console.log('· seeding demo data')
  await page.goto(`${BASE_URL}/app/settings`, { waitUntil: 'domcontentloaded', timeout: 180_000 })
  await page.getByRole('button', { name: 'Reset & load demo' }).click()
  await page.getByRole('textbox', { name: /confirm/i }).fill('DEMO')
  // The dialog's confirm button shares its label with the trigger behind it.
  await page.getByRole('alertdialog').getByRole('button', { name: 'Reset & load demo' }).click()
  await page.waitForTimeout(4000)
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })
  const now = new Date()

  const browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: SCALE,
    colorScheme: 'dark',
  })
  // Belt and braces: inject the overlay-hiding CSS into every document as it loads,
  // so a shot can never race the badge appearing.
  await context.addInitScript((css) => {
    const apply = () => {
      const s = document.createElement('style')
      s.textContent = css
      document.head?.appendChild(s)
    }
    if (document.head) apply()
    else document.addEventListener('DOMContentLoaded', apply)
  }, HIDE_DEV_OVERLAY)

  const page = await context.newPage()
  page.setDefaultTimeout(120_000)
  page.setDefaultNavigationTimeout(180_000)

  console.log(`· capturing from ${BASE_URL} at ${VIEWPORT.width}x${VIEWPORT.height}@${SCALE}x`)
  console.log(`· writing to ${OUT_DIR}`)

  if (process.env.NO_SEED !== '1') await seedDemoData(page)

  // 1. Dashboard — the hero shot. Pinned to the previous, COMPLETE month: the
  //    current month is only part-elapsed, so its income card reads $0.00 until
  //    payday and the donut is thin.
  await page.goto(`${BASE_URL}/app?month=${previousMonthParam(now)}`, {
    waitUntil: 'domcontentloaded',
  })
  await page.getByText('Total net worth').waitFor()
  await shot(page, 'dashboard')

  // 2. Transactions — categorised rows.
  await page.goto(`${BASE_URL}/app/transactions`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('heading', { name: 'Transactions' }).waitFor()
  await shot(page, 'transactions')

  // 3. Financial-year report + tax helper. (Match the heading, not the
  //    "Spending by category" label — that string is also the donut's SVG <title>,
  //    which trips Playwright's strict mode.)
  await page.goto(`${BASE_URL}/app/reports/${previousFinancialYear(now)}`, {
    waitUntil: 'domcontentloaded',
  })
  await page.getByRole('heading', { name: 'Tax helper' }).waitFor()
  await shot(page, 'fy-report')

  // 4. CSV column mapping. Reached the way a user reaches it — pick an account,
  //    then upload a statement — because the account ids are freshly generated by
  //    each seed and can't be hard-coded.
  await page.goto(`${BASE_URL}/app/import`, { waitUntil: 'domcontentloaded' })
  // Read the account's URL and navigate to it directly rather than clicking
  // through. The ids are regenerated by every seed so they can't be hard-coded,
  // but a full load gives the uploader a deterministic starting point.
  const importHref = await page.locator('main a[href*="/import"]').first().getAttribute('href')
  await page.goto(`${BASE_URL}${importHref}`, { waitUntil: 'domcontentloaded' })
  await page.getByText('Upload a CSV statement').waitFor()
  // Wait for hydration before touching the picker. The <input type=file> is real
  // markup and accepts a file the moment it exists, but the component's change
  // handler is attached during hydration — click too early and the file lands on a
  // node nothing is listening to, so the preview never renders and this hangs.
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.waitForTimeout(1500)
  // Go through the real file chooser rather than setInputFiles on the hidden
  // <input>: the picker is what the component is wired to.
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByText('Choose CSV').click(),
  ])
  await chooser.setFiles(FIXTURE)
  await page.getByText('File preview').waitFor()
  // The mapping is auto-detected from the header row; wait for the parsed preview
  // to confirm it landed before shooting.
  await page.getByText(/\d+\s*ok/).waitFor()
  await shot(page, 'csv-mapping')

  await browser.close()
  console.log('· done')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
