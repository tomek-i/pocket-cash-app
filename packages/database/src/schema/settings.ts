import { jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

/** AI provider configuration (see @repo/ai). Secrets stay server-side. */
export interface AiSettings {
  mode: 'off' | 'anthropic' | 'ollama' | 'claude-cli'
  anthropicApiKey?: string
  ollamaBaseUrl?: string
  fastModel?: string
  smartModel?: string
}

/** A cached AI-generated summary, keyed by view; invalidated by `fingerprint`. */
export interface CachedInsight {
  fingerprint: string
  summary: string
  highlights: string[]
  generatedAt: string
}

/** The app's persisted settings blob — one row for this single-user install. */
export interface AppSettings {
  defaultCurrency?: string
  ai?: AiSettings
  aiInsights?: Record<string, CachedInsight>
  /** Set once the first-run welcome tour is finished. Unset/false = show it. */
  onboardingCompleted?: boolean
}

/**
 * Single-row settings table. Pocket Cash is a local, single-user app, so there is
 * exactly one settings row (id `app`), holding the JSON {@link AppSettings} blob.
 * Read/write via the helpers in `../settings-store`.
 */
export const appSettings = pgTable('app_settings', {
  id: text('id').primaryKey(),
  settings: jsonb('settings').$type<AppSettings>().notNull().default({}),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type AppSettingsRow = typeof appSettings.$inferSelect
