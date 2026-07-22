import { defineConfig } from 'vitest/config'

// Single root config running unit tests across all packages. Pure-logic tests
// live next to their source as *.test.ts. E2E (Playwright) is separate and
// excluded here.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['packages/**/src/**/*.test.ts', 'apps/**/src/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.next/**', '**/e2e/**'],
  },
})
