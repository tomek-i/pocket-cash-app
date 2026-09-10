'use client'

import {
  Button,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@repo/ui'
import { Plus } from 'lucide-react'
import { useTransition } from 'react'
import { type TagLike, TagPill, TagSwatch } from '../../tags/_components/tag-pill'
import { toggleTransactionTag } from '../actions'

/** The tag fields this cell needs, which is what `TagPill` and `TagSwatch` take. */
type TagLite = TagLike

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
        <TagPill key={t.id} tag={t} />
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
          <DropdownMenuGroup>
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
                  <TagSwatch tag={t} />
                </DropdownMenuCheckboxItem>
              ))
            )}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
