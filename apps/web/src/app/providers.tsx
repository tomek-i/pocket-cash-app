import type { ReactNode } from 'react'

// Local-only desktop app: no analytics, no telemetry, nothing phones home.
// Kept as a single mount point in case client-side providers are added later.
export function Providers({ children }: { children: ReactNode }) {
  return <>{children}</>
}
