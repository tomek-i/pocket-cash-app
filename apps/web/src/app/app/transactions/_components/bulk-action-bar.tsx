'use client'

import type { Category, Tag } from '@repo/database'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@repo/ui'
import { ArrowLeftRight, ChevronDown, Trash2, X } from 'lucide-react'
import { useState, useTransition } from 'react'
import { CategoryIcon } from '../../categories/_components/category-icon'
import { TagSwatch } from '../../tags/_components/tag-pill'
import { bulkDeleteTransactions, bulkUpdateTransactions } from '../actions'
import { markAsTransfers } from '../transfer-actions'

type CategoryLite = Pick<Category, 'id' | 'name' | 'color' | 'icon'>
type TagLite = Pick<Tag, 'id' | 'name' | 'color'>

/**
 * Actions for the selected rows of the transactions table. Each one applies to
 * every selected row straight away, then clears the selection.
 */
export function BulkActionBar({
  ids,
  categories,
  tags,
  onDone,
}: {
  ids: string[]
  categories: CategoryLite[]
  tags: TagLite[]
  /** Called after an action succeeds, to clear the selection. */
  onDone: () => void
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const count = ids.length
  const rows = `${count} transaction${count === 1 ? '' : 's'}`

  const run = (fn: () => Promise<{ ok: true } | { error: string }>) =>
    startTransition(async () => {
      setError(null)
      const res = await fn()
      if ('error' in res) {
        setError(res.error)
        return
      }
      setConfirmOpen(false)
      onDone()
    })

  return (
    <div className="flex flex-wrap items-center gap-2 border-b bg-muted/30 px-3 py-2">
      <span className="font-medium text-sm">{count} selected</span>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="outline" size="sm" className="h-8 gap-1" disabled={pending}>
              Set category
              <ChevronDown className="size-3.5" />
            </Button>
          }
        />
        <DropdownMenuContent align="start" className="max-h-72 w-52 overflow-auto">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Set category on {rows}</DropdownMenuLabel>
            {categories.map((c) => (
              <DropdownMenuItem
                key={c.id}
                onClick={() => run(() => bulkUpdateTransactions({ ids, setCategoryId: c.id }))}
              >
                <CategoryIcon name={c.icon} color={c.color} className="size-4" />
                {c.name}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => run(() => bulkUpdateTransactions({ ids, setCategoryId: null }))}
            >
              Uncategorise
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="outline" size="sm" className="h-8 gap-1" disabled={pending}>
              Add tag
              <ChevronDown className="size-3.5" />
            </Button>
          }
        />
        <DropdownMenuContent align="start" className="max-h-72 w-48 overflow-auto">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Add a tag to {rows}</DropdownMenuLabel>
            {tags.length === 0 ? (
              <DropdownMenuItem disabled>No tags yet</DropdownMenuItem>
            ) : (
              tags.map((t) => (
                <DropdownMenuItem
                  key={t.id}
                  onClick={() => run(() => bulkUpdateTransactions({ ids, addTagIds: [t.id] }))}
                >
                  <TagSwatch tag={t} />
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        variant="outline"
        size="sm"
        className="h-8 gap-1.5"
        disabled={pending}
        onClick={() => run(() => markAsTransfers(ids))}
      >
        <ArrowLeftRight className="size-3.5" />
        Mark as transfer
      </Button>

      <Button
        variant="outline"
        size="sm"
        className="h-8 gap-1.5 text-destructive hover:text-destructive"
        disabled={pending}
        onClick={() => setConfirmOpen(true)}
      >
        <Trash2 className="size-3.5" />
        Delete
      </Button>

      <Button
        variant="ghost"
        size="sm"
        className="ml-auto h-8 gap-1"
        disabled={pending}
        onClick={onDone}
      >
        <X className="size-3.5" />
        Clear
      </Button>

      {error ? <p className="basis-full text-destructive text-xs">{error}</p> : null}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {rows}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the {rows} you selected. Importing the same file again brings
              them back.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button" disabled={pending}>
              Cancel
            </AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => run(() => bulkDeleteTransactions(ids))}
            >
              Delete {rows}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
