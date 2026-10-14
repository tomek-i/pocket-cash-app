import {
  cn,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  Empty as EmptyRoot,
  EmptyTitle,
} from '@repo/ui'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

/**
 * Shared empty-state block: an icon tile, a title, an optional description, and an
 * optional action. Drop it inside a Card (or a card's content) so every "nothing
 * here yet" state looks the same across the app. Built from the shadcn `Empty`
 * parts in `@repo/ui`.
 */
export function Empty({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon
  title: string
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <EmptyRoot className={cn('gap-3 p-8', className)}>
      <EmptyHeader className="gap-0">
        <EmptyMedia variant="icon" className="mb-3 size-12 rounded-xl text-muted-foreground">
          <Icon />
        </EmptyMedia>
        <EmptyTitle className="text-base tracking-normal">{title}</EmptyTitle>
        {description ? <EmptyDescription>{description}</EmptyDescription> : null}
      </EmptyHeader>
      {action ? (
        <EmptyContent className="flex-row flex-wrap justify-center gap-2">{action}</EmptyContent>
      ) : null}
    </EmptyRoot>
  )
}
