'use client'

import { Button, cn } from '@repo/ui'
import {
  ArrowLeftRight,
  BarChart3,
  Landmark,
  LayoutDashboard,
  RefreshCw,
  Settings,
  Shapes,
  Sparkles,
  Tag,
  Upload,
  Wallet,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

const nav = [
  { href: '/app', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/app/banks', label: 'Banks', icon: Landmark },
  { href: '/app/accounts', label: 'Accounts', icon: Wallet },
  { href: '/app/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { href: '/app/categorize', label: 'Categorise', icon: Sparkles },
  { href: '/app/reports', label: 'Reports', icon: BarChart3 },
  { href: '/app/subscriptions', label: 'Subscriptions', icon: RefreshCw },
  { href: '/app/categories', label: 'Categories', icon: Shapes },
  { href: '/app/tags', label: 'Tags', icon: Tag },
  { href: '/app/settings', label: 'Settings', icon: Settings },
]

export function AppSidebar({ footer }: { footer: ReactNode }) {
  const pathname = usePathname()

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r bg-card/40 lg:flex">
      <div className="flex h-16 items-center gap-2.5 px-5">
        {/* biome-ignore lint/performance/noImgElement: tiny static local asset; the Next image optimizer is undesirable in the offline desktop build */}
        <img src="/logo.png" alt="" className="size-9 rounded-lg object-contain" />
        <div className="leading-tight">
          <p className="font-semibold text-sm">Pocket Cash</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
            Personal Finance
          </p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 px-3 py-3">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = href === '/app' ? pathname === '/app' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-muted-foreground text-sm transition-colors hover:bg-accent hover:text-foreground',
                active && 'bg-accent font-medium text-accent-foreground',
              )}
            >
              <Icon className="size-[18px]" />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="px-3 pb-3">
        <Button className="w-full gap-2" render={<Link href="/app/import" />} nativeButton={false}>
          <Upload className="size-4" />
          Import CSV
        </Button>
      </div>

      {/* <div className="border-t p-3">{footer}</div> */}
    </aside>
  )
}
