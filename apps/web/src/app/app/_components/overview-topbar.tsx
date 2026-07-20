'use client'

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
} from '@repo/ui'
import { CalendarDays, ChevronDown, Search, SlidersHorizontal } from 'lucide-react'
import { useState } from 'react'

const MONTHS = ['March 2026', 'April 2026', 'May 2026', 'June 2026']

export function OverviewTopbar() {
  const [month, setMonth] = useState('June 2026')

  return (
    <div className="flex items-center gap-2">
      <div className="relative hidden sm:block">
        <Search className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-muted-foreground" />
        <Input
          placeholder="Search transactions…"
          className="h-9 w-56 bg-card pl-9 lg:w-64"
          aria-label="Search transactions"
        />
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="outline" size="sm" className="gap-2 bg-card">
              <CalendarDays className="size-4 text-muted-foreground" />
              {month}
              <ChevronDown className="size-4 text-muted-foreground" />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="min-w-[10rem]">
          <DropdownMenuLabel>Period</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {MONTHS.map((m) => (
            <DropdownMenuItem key={m} onSelect={() => setMonth(m)}>
              {m}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Button variant="outline" size="icon" className="bg-card" aria-label="Settings">
        <SlidersHorizontal className="size-4 text-muted-foreground" />
      </Button>
    </div>
  )
}
