import { getAppSettings } from '@repo/database'
import { cache } from 'react'
import { resolveNumberLocale } from './number-format'

/**
 * The locale dates are shown in, for server components: the number format
 * chosen in Settings, or the machine's own. Cached per request.
 */
export const getDateLocale = cache(async (): Promise<string> => {
  return resolveNumberLocale((await getAppSettings()).numberLocale)
})
