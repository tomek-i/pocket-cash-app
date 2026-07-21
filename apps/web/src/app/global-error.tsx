'use client'

import type { CSSProperties } from 'react'
import { getDesktopBridge } from '@/lib/desktop'

/**
 * Last-resort boundary: catches errors thrown by the root layout itself, which
 * the per-segment boundaries can't reach. It REPLACES the root layout (must
 * render its own <html>/<body>), and globals.css isn't guaranteed here, so styles
 * are inline. Keep it dependency-free and tiny.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const desktop = getDesktopBridge()
  return (
    <html lang="en">
      <body style={bodyStyle}>
        <div style={{ maxWidth: '28rem', textAlign: 'center', padding: '2rem' }}>
          <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>The app hit a problem</h1>
          <p style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#9095a8' }}>
            An unexpected error occurred. {desktop?.isElectron ? 'Restarting' : 'Reloading'} usually
            fixes it.
          </p>
          {error.digest ? (
            <p
              style={{
                marginTop: '0.5rem',
                fontFamily: 'monospace',
                fontSize: '0.75rem',
                color: '#62657a',
              }}
            >
              Ref: {error.digest}
            </p>
          ) : null}
          <div
            style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '1rem' }}
          >
            <button type="button" onClick={() => reset()} style={primaryButton}>
              Try again
            </button>
            {desktop?.isElectron ? (
              <button type="button" onClick={() => desktop.relaunch?.()} style={secondaryButton}>
                Restart app
              </button>
            ) : (
              <button
                type="button"
                onClick={() => window.location.reload()}
                style={secondaryButton}
              >
                Reload
              </button>
            )}
          </div>
        </div>
      </body>
    </html>
  )
}

const bodyStyle: CSSProperties = {
  margin: 0,
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#0a0a08',
  color: '#f6f6f0',
  fontFamily: 'system-ui, -apple-system, sans-serif',
}

const baseButton: CSSProperties = {
  cursor: 'pointer',
  borderRadius: '0.5rem',
  padding: '0.5rem 0.9rem',
  fontSize: '0.875rem',
  fontWeight: 500,
}

const primaryButton: CSSProperties = {
  ...baseButton,
  border: '1px solid #e5e52e',
  background: '#e5e52e',
  color: '#0a0a08',
}

const secondaryButton: CSSProperties = {
  ...baseButton,
  border: '1px solid #24241d',
  background: 'transparent',
  color: '#f6f6f0',
}
