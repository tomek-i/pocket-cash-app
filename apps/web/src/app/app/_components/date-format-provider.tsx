'use client'

import { createContext, type ReactNode, useContext } from 'react'
import { type DateFormatOptions, formatDate, formatMonth } from '@/lib/date-format'

const DateLocaleContext = createContext<string | undefined>(undefined)

/**
 * Hands the Settings locale to client components, so they format dates the same
 * way the server does. Set once in the app layout.
 */
export function DateFormatProvider({ locale, children }: { locale: string; children: ReactNode }) {
  return <DateLocaleContext.Provider value={locale}>{children}</DateLocaleContext.Provider>
}

/** Date formatting in the Settings locale, for client components. */
export function useDateFormat() {
  const locale = useContext(DateLocaleContext) ?? 'en'
  return {
    date: (iso: string, options?: DateFormatOptions) => formatDate(iso, locale, options),
    month: (key: string, style?: 'long' | 'name' | 'short') => formatMonth(key, locale, style),
  }
}
