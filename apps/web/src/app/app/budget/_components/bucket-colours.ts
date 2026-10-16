import type { BudgetBucketType } from '@repo/budget'

/** One theme chart colour per bucket, so a bucket looks the same everywhere. */
export const BUCKET_COLOURS: Record<BudgetBucketType, string> = {
  essentials: 'var(--chart-5)',
  lifestyle: 'var(--chart-3)',
  savings: 'var(--chart-2)',
  investing: 'var(--chart-1)',
  debt: 'var(--chart-4)',
}

/** Basis points as a whole percent, e.g. 5000 → "50%". */
export function formatShare(share: number): string {
  return `${Math.round(share / 100)}%`
}
