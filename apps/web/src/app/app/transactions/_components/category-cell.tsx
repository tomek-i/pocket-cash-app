'use client'

import type { Category } from '@repo/database'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@repo/ui'
import { useTransition } from 'react'
import { CategoryIcon } from '../../categories/_components/category-icon'
import { setTransactionCategory } from '../actions'

type CategoryLite = Pick<Category, 'id' | 'name' | 'color' | 'icon'>

export function CategoryCell({
  transactionId,
  category,
  categories,
}: {
  transactionId: string
  category: CategoryLite | null
  categories: CategoryLite[]
}) {
  const [pending, startTransition] = useTransition()

  return (
    <Select
      value={category?.id ?? 'none'}
      disabled={pending}
      onValueChange={(v) =>
        startTransition(async () => {
          await setTransactionCategory(transactionId, !v || v === 'none' ? null : v)
        })
      }
    >
      <SelectTrigger className="h-8 w-44">
        <SelectValue placeholder="Uncategorised" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">Uncategorised</SelectItem>
        {categories.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            <span className="flex items-center gap-2">
              <CategoryIcon name={c.icon} color={c.color} className="size-4" />
              {c.name}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
