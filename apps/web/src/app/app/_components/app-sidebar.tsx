'use client'

import { Button, cn } from '@repo/ui'
import {
  ArrowLeftRight,
  BarChart3,
  Building2,
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

/**
 * Grouped by the question each destination answers, not by how the app is built.
 *
 * Eleven links in one flat column read as a wall: everything has equal weight, so
 * nothing is findable except by reading all of it. The groups below give the eye
 * somewhere to stop, and they encode something true. **Money** is what happened
 * and where it sits. **Planning** is what it means and what is next. **Setup** is
 * what you configure once and rarely touch.
 *
 * Headings rather than collapsible submenus, deliberately: at this size every
 * destination stays one click away and none of it hides. Collapsing earns its
 * complexity somewhere north of thirty items, not eleven.
 */
const GROUPS = [
  {
    // The overview is the landing page, so it sits above the grouping rather than
    // inside a group of one.
    label: null,
    items: [{ href: '/app', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'Money',
    items: [
      { href: '/app/banks', label: 'Banks', icon: Landmark },
      { href: '/app/accounts', label: 'Accounts', icon: Wallet },
      { href: '/app/transactions', label: 'Transactions', icon: ArrowLeftRight },
      { href: '/app/categorize', label: 'Categorise', icon: Sparkles },
    ],
  },
  {
    label: 'Planning',
    items: [
      { href: '/app/reports', label: 'Reports', icon: BarChart3 },
      { href: '/app/property', label: 'Property', icon: Building2 },
      { href: '/app/subscriptions', label: 'Subscriptions', icon: RefreshCw },
    ],
  },
  {
    label: 'Setup',
    items: [
      { href: '/app/categories', label: 'Categories', icon: Shapes },
      { href: '/app/tags', label: 'Tags', icon: Tag },
      { href: '/app/settings', label: 'Settings', icon: Settings },
    ],
  },
]

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r bg-card/40 lg:flex">
      <div className="flex h-16 shrink-0 items-center gap-2.5 px-5">
        {/* biome-ignore lint/performance/noImgElement: tiny static local asset; the Next image optimizer is undesirable in the offline desktop build */}
        <img src="/logo.png" alt="" className="size-9 rounded-lg object-contain" />
        <div className="leading-tight">
          <p className="font-semibold text-sm">Pocket Cash</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
            Personal Finance
          </p>
        </div>
      </div>

      {/* Scrolls rather than overflowing: the headings make the nav taller, and a
          short window would otherwise push Import CSV off the bottom. */}
      <nav aria-label="Main" className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-3">
        {GROUPS.map((group) => {
          // The visible heading labels the list itself, so a screen reader
          // announces "Money, list, 4 items" rather than reading a stray line of
          // text above an unlabelled one.
          const headingId = group.label ? `nav-${group.label.toLowerCase()}` : undefined

          return (
            <div key={group.label ?? 'overview'}>
              {group.label ? (
                <p
                  id={headingId}
                  className="px-3 pb-1 font-medium text-[10px] text-muted-foreground/70 uppercase tracking-wider"
                >
                  {group.label}
                </p>
              ) : null}

              <ul aria-labelledby={headingId} className="flex list-none flex-col gap-0.5 p-0">
                {group.items.map(({ href, label, icon: Icon }) => {
                  const active = href === '/app' ? pathname === '/app' : pathname.startsWith(href)
                  return (
                    <li key={href}>
                      <Link
                        href={href}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'flex items-center gap-3 rounded-md px-3 py-2 text-muted-foreground text-sm transition-colors hover:bg-accent hover:text-foreground',
                          active && 'bg-accent font-medium text-accent-foreground',
                        )}
                      >
                        <Icon className="size-4.5" />
                        {label}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </nav>

      <div className="shrink-0 px-3 pb-3">
        <Button className="w-full gap-2" render={<Link href="/app/import" />} nativeButton={false}>
          <Upload className="size-4" />
          Import CSV
        </Button>
      </div>
    </aside>
  )
}
