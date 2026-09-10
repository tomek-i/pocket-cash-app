'use client'

import { HelpCircle } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '../lib/cn'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'

/**
 * A "?" beside a label that explains what the field means.
 *
 * A composite over the vendored `Tooltip`, not a replacement for it: reach for
 * `Tooltip` directly when something else needs a hover explanation. This exists
 * so the help affordance itself is written once, because the parts that are easy
 * to get wrong are the same every time.
 *
 * - `type="button"`, since these sit inside forms and a bare button submits.
 * - An accessible name on the trigger, so it is reachable by keyboard and
 *   announced, rather than being hover-only decoration.
 */
export function HelpTip({
  children,
  label = 'What is this?',
  className,
}: {
  children: ReactNode
  /** The trigger's accessible name. Worth setting when a page has several. */
  label?: string
  className?: string
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        type="button"
        aria-label={label}
        className={cn(
          'inline-flex size-4 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50',
          className,
        )}
      >
        <HelpCircle className="size-3.5" />
      </TooltipTrigger>
      <TooltipContent className="max-w-72 leading-relaxed">{children}</TooltipContent>
    </Tooltip>
  )
}
