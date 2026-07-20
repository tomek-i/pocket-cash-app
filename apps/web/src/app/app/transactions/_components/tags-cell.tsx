'use client'

import type { Tag } from '@repo/database'
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@repo/ui'
import { Plus } from 'lucide-react'
import { useTransition } from 'react'
import { toggleTransactionTag } from '../actions'

type TagLite = Pick<Tag, 'id' | 'name' | 'color'>

export function TagsCell({
  transactionId,
  tags,
  allTags,
}: {
  transactionId: string
  tags: TagLite[]
  allTags: TagLite[]
}) {
  const [pending, startTransition] = useTransition()
  const assigned = new Set(tags.map((t) => t.id))

  return (
    <div className="flex flex-wrap items-center gap-1">
      {tags.map((t) => (
        <Badge
          key={t.id}
          variant="secondary"
          style={t.color ? { borderColor: t.color, color: t.color } : undefined}
        >
          {t.name}
        </Badge>
      ))}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon" className="size-7" aria-label="Edit tags">
              <Plus className="size-3.5" />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>Tags</DropdownMenuLabel>
          {allTags.length === 0 ? (
            <DropdownMenuItem disabled>No tags yet</DropdownMenuItem>
          ) : (
            allTags.map((t) => (
              <DropdownMenuCheckboxItem
                key={t.id}
                checked={assigned.has(t.id)}
                disabled={pending}
                closeOnClick={false}
                onCheckedChange={(checked) =>
                  startTransition(async () => {
                    await toggleTransactionTag(transactionId, t.id, checked)
                  })
                }
              >
                {t.name}
              </DropdownMenuCheckboxItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
