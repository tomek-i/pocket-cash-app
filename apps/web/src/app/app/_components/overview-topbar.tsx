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

/** Header search: jumps to the transactions list with the query applied. */
export function OverviewSearch() {
  const router = useRouter()
  const [query, setQuery] = useState('')

  function onSearch(e: FormEvent) {
    e.preventDefault()
    const q = query.trim()
    router.push(q ? `/app/transactions?q=${encodeURIComponent(q)}` : '/app/transactions')
  }

  return (
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
  )
}

/**
 * The month the dashboard's monthly cards cover, via the `?month=` URL param
 * (the current month drops it). Sits with those cards, not in the page header,
 * because it does not change the figures that are always "now".
 */
export function MonthPicker({ months, selected }: { months: MonthOption[]; selected: string }) {
  const router = useRouter()

  // The newest option is the current month; selecting it clears the param.
  const currentKey = months[0]?.key
  const selectedLabel = months.find((m) => m.key === selected)?.label ?? months[0]?.label ?? ''

  function selectMonth(key: string) {
    router.push(key === currentKey ? '/app' : `/app?month=${key}`, { scroll: false })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm" className="gap-2 bg-card" aria-label="Choose month">
            <CalendarDays className="size-4 text-muted-foreground" />
            {selectedLabel}
            <ChevronDown className="size-4 text-muted-foreground" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="max-h-72 min-w-[11rem] overflow-y-auto">
        <DropdownMenuRadioGroup value={selected} onValueChange={selectMonth}>
          <DropdownMenuLabel>Month</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {months.map((m) => (
            <DropdownMenuRadioItem key={m.key} value={m.key}>
              {m.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
