import { defineConfig, devices } from '@playwright/test'

const PORT = 3000
// Use 127.0.0.1 (not "localhost") and disable the browser proxy below so tests
// work on machines with a system HTTP proxy that can't resolve localhost.
const baseURL = `http://127.0.0.1:${PORT}`

/**
 * E2E config. Starts the dev server automatically (reusing one if already
 * running). The example spec only exercises public marketing pages so it runs
 * without real auth credentials.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
    // Use a direct connection so tests work behind a system HTTP proxy that
    // can't resolve loopback addresses.
    launchOptions: { args: ['--no-proxy-server'] },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm dev',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
