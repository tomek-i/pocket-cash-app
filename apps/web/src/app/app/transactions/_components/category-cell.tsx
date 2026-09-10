'use client'

import type { Category } from '@repo/database'
import { OptionSelect } from '@repo/ui'
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
    <OptionSelect
      className="h-8 w-44"
      value={category?.id ?? 'none'}
      disabled={pending}
      placeholder="Uncategorised"
      onValueChange={(v) =>
        startTransition(async () => {
          await setTransactionCategory(transactionId, v === 'none' ? null : v)
        })
      }
      options={[
        { value: 'none', label: 'Uncategorised' },
        ...categories.map((c) => ({
          value: c.id,
          label: (
            <span className="flex items-center gap-2">
              <CategoryIcon name={c.icon} color={c.color} className="size-4" />
              {c.name}
            </span>
          ),
        })),
      ]}
    />
  )
}
