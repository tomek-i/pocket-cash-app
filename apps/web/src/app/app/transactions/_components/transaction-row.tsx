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
  Badge,
  Button,
  cn,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@repo/ui'
import { MoreVertical, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { amountClassName, formatMoney } from '@/lib/money'
import { CategoryIcon } from '../../categories/_components/category-icon'
import {
  deleteTransaction,
  setTransactionCategory,
  type TransactionRow as TxRow,
  toggleTransactionTag,
} from '../actions'

type CategoryLite = Pick<Category, 'id' | 'name' | 'color' | 'icon'>
type TagLite = Pick<Tag, 'id' | 'name' | 'color'>

const badgeStyle = (color: string | null) => (color ? { borderColor: color, color } : undefined)

export function TransactionRow({
  tx,
  categories,
  tags,
}: {
  tx: TxRow
  categories: CategoryLite[]
  tags: TagLite[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const assigned = new Set(tx.tags.map((t) => t.id))

  const run = (fn: () => Promise<unknown>) => startTransition(() => void fn())

  return (
    <tr
      className="cursor-pointer border-b last:border-0 hover:bg-muted/30"
      onClick={() => router.push(`/app/transactions/${tx.id}`)}
    >
      <td className="whitespace-nowrap p-3 align-top text-muted-foreground text-xs">{tx.date}</td>
      <td className="max-w-[22rem] p-3 align-top">
        <p className="truncate font-medium">{tx.displayName ?? tx.description}</p>
        <p className="truncate text-muted-foreground text-xs">
          {tx.account.name}
          {tx.merchant ? ` · ${tx.merchant}` : ''}
        </p>
      </td>
      <td className="p-3 align-top">
        {tx.category ? (
          <Badge variant="secondary" className="gap-1.5" style={badgeStyle(tx.category.color)}>
            <CategoryIcon name={tx.category.icon} color={tx.category.color} className="size-3" />
            {tx.category.name}
          </Badge>
        ) : (
          <span className="text-muted-foreground text-sm">—</span>
        )}
      </td>
      <td className="max-w-[16rem] p-3 align-top">
        {tx.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {tx.tags.map((t) => (
              <Badge key={t.id} variant="secondary" style={badgeStyle(t.color)}>
                {t.name}
              </Badge>
            ))}
          </div>
        ) : (
          <span className="text-muted-foreground text-sm">—</span>
        )}
      </td>
      <td
        className={cn(
          'whitespace-nowrap p-3 text-right align-top font-medium tabular-nums',
          amountClassName(tx.amount),
        )}
      >
        {formatMoney(tx.amount, tx.currency)}
      </td>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: stop row navigation for the menu cell */}
      <td className="p-3 text-right align-top" onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label="Transaction actions"
              >
                <MoreVertical className="size-4" />
              </Button>
            }
            nativeButton={false}
          />
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Category</DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="max-h-72 overflow-auto">
                <DropdownMenuRadioGroup
                  value={tx.category?.id ?? 'none'}
                  onValueChange={(v) =>
                    run(() => setTransactionCategory(tx.id, !v || v === 'none' ? null : v))
                  }
                >
                  <DropdownMenuRadioItem value="none">Uncategorised</DropdownMenuRadioItem>
                  {categories.map((c) => (
                    <DropdownMenuRadioItem key={c.id} value={c.id}>
                      <span className="flex items-center gap-2">
                        <CategoryIcon name={c.icon} color={c.color} className="size-4" />
                        {c.name}
                      </span>
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Tags</DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="max-h-72 overflow-auto">
                {tags.length === 0 ? (
                  <DropdownMenuItem disabled>No tags yet</DropdownMenuItem>
                ) : (
                  tags.map((t) => (
                    <DropdownMenuCheckboxItem
                      key={t.id}
                      checked={assigned.has(t.id)}
                      closeOnClick={false}
                      onCheckedChange={(checked) =>
                        run(() => toggleTransactionTag(tx.id, t.id, checked))
                      }
                    >
                      {t.name}
                    </DropdownMenuCheckboxItem>
                  ))
                )}
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => setConfirmOpen(true)}
            >
              <Trash2 className="size-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete transaction?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently removes “{tx.displayName ?? tx.description}”.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel type="button" disabled={pending}>
                Cancel
              </AlertDialogCancel>
              <Button
                variant="destructive"
                disabled={pending}
                onClick={() =>
                  run(async () => {
                    await deleteTransaction(tx.id)
                    setConfirmOpen(false)
                  })
                }
              >
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </td>
    </tr>
  )
}
