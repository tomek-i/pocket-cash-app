import './globals.css'
import { GeistMono } from 'geist/font/mono'
import { GeistSans } from 'geist/font/sans'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Providers } from './providers'

export const metadata: Metadata = {
  title: {
    default: 'Pocket Cash',
    template: '%s · Pocket Cash',
  },
  description: 'Personal finance, in your pocket.',
  // Single source of truth: the same logo the desktop build packages as its app
  // icon (apps/web/public/logo.png, copied by scripts/prepare-icon.mjs).
  icons: { icon: '/logo.png', apple: '/logo.png' },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`dark ${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
