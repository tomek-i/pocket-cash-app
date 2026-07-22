'use client'

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
} from '@repo/ui'
import { CalendarDays, ChevronDown, Search } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { type FormEvent, useState } from 'react'

/** A `YYYY-MM` month with a human label, e.g. `{ key: '2026-06', label: 'June 2026' }`. */
export interface MonthOption {
  key: string
  label: string
}

/**
 * The Overview header controls. Search jumps to the transactions list with the
 * query pre-applied; the period picker scopes the dashboard's monthly widgets to
 * the chosen month via the `?month=` URL param (the current month drops it).
 */
export function OverviewTopbar({ months, selected }: { months: MonthOption[]; selected: string }) {
  const router = useRouter()
  const [query, setQuery] = useState('')

  // The newest option is the current month; selecting it clears the param.
  const currentKey = months[0]?.key
  const selectedLabel = months.find((m) => m.key === selected)?.label ?? months[0]?.label ?? ''

  function onSearch(e: FormEvent) {
    e.preventDefault()
    const q = query.trim()
    router.push(q ? `/app/transactions?q=${encodeURIComponent(q)}` : '/app/transactions')
  }

  function selectMonth(key: string) {
    router.push(key === currentKey ? '/app' : `/app?month=${key}`)
  }

  return (
    <div className="flex items-center gap-2">
      <form onSubmit={onSearch} className="relative hidden sm:block">
        <Search className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search transactions…"
          className="h-9 w-56 bg-card pl-9 lg:w-64"
          aria-label="Search transactions"
          type="search"
        />
      </form>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="outline" size="sm" className="gap-2 bg-card">
              <CalendarDays className="size-4 text-muted-foreground" />
              {selectedLabel}
              <ChevronDown className="size-4 text-muted-foreground" />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="max-h-72 min-w-[11rem] overflow-y-auto">
          <DropdownMenuRadioGroup value={selected} onValueChange={selectMonth}>
            <DropdownMenuLabel>Period</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {months.map((m) => (
              <DropdownMenuRadioItem key={m.key} value={m.key}>
                {m.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
