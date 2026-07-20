/** Promise-based delay. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export interface RetryOptions {
  retries?: number
  /** Base delay in ms; grows exponentially with each attempt. */
  baseDelayMs?: number
  /** Optional predicate — return false to stop retrying a given error. */
  shouldRetry?: (error: unknown) => boolean
}

/** Retry an async operation with exponential backoff. */
export async function retry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const { retries = 3, baseDelayMs = 200, shouldRetry = () => true } = options
  let lastError: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      if (attempt === retries || !shouldRetry(error)) break
      await sleep(baseDelayMs * 2 ** attempt)
    }
  }
  throw lastError
}
