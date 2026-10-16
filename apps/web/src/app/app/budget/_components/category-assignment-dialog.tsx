'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  OptionSelect,
} from '@repo/ui'
import { type ReactElement, useState, useTransition } from 'react'
import { CategoryIcon } from '../../categories/_components/category-icon'
import {
  assignCategoryToBucket,
  type BudgetBucketView,
  type BudgetCategory,
  type CategoryPlacement,
} from '../actions'
import { BUCKET_COLOURS } from './bucket-colours'

const UNBUDGETED = 'none'
const EXCLUDED = 'excluded'

/**
 * Every category with a bucket picker. Each change saves on its own, and the
 * picked value shows straight away while the save runs.
 */
export function CategoryAssignmentDialog({
  categories,
  buckets,
  trigger,
  unbudgetedOnly = false,
}: {
  categories: BudgetCategory[]
  buckets: BudgetBucketView[]
  trigger: ReactElement
  /** Open with the list filtered to unbudgeted categories. */
  unbudgetedOnly?: boolean
}) {
  const [, startTransition] = useTransition()
  const [picked, setPicked] = useState<Record<string, string>>({})
  const [onlyUnbudgeted, setOnlyUnbudgeted] = useState(unbudgetedOnly)

  const options = [
    ...buckets.map((bucket) => ({
      value: bucket.type,
      label: (
        <span className="flex items-center gap-2">
          <span
            aria-hidden
            className="size-2.5 rounded-full"
            style={{ backgroundColor: BUCKET_COLOURS[bucket.type] }}
          />
          {bucket.label}
          {bucket.kind === 'save' ? (
            <span className="text-muted-foreground text-xs">(save)</span>
          ) : null}
        </span>
      ),
    })),
    { value: EXCLUDED, label: <span className="text-muted-foreground">Not spending</span> },
    { value: UNBUDGETED, label: <span className="text-muted-foreground">Unbudgeted</span> },
  ]

  const bucketValueOf = (category: BudgetCategory) =>
    picked[category.id] ?? category.bucketType ?? (category.excluded ? EXCLUDED : UNBUDGETED)
  const visible = onlyUnbudgeted
    ? categories.filter((category) => category.bucketType === null && !category.excluded)
    : categories

  return (
    <Dialog
      onOpenChange={(open) => {
        if (open) setOnlyUnbudgeted(unbudgetedOnly)
      }}
    >
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Assign categories to buckets</DialogTitle>
          <DialogDescription>
            Each category goes in one bucket. Categories in a save bucket, such as extra repayments
            or ETF purchases, count as saved, not spent. Mark income and transfers as Not spending.
          </DialogDescription>
        </DialogHeader>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={onlyUnbudgeted}
            onChange={(event) => setOnlyUnbudgeted(event.target.checked)}
            className="size-4 accent-primary"
          />
          Show unbudgeted only
        </label>

        {visible.length === 0 ? (
          <p className="py-6 text-center text-muted-foreground text-sm">
            {categories.length === 0
              ? 'No categories yet. Add some on the Categories page first.'
              : 'Every category is in a bucket.'}
          </p>
        ) : (
          <ul className="-mx-1 grid max-h-[55vh] list-none gap-1 overflow-y-auto p-1">
            {visible.map((category) => (
              <li
                key={category.id}
                className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-muted/50"
              >
                <span className="flex min-w-0 items-center gap-2 text-sm">
                  <CategoryIcon name={category.icon} color={category.color} className="size-4" />
                  <span className="truncate">{category.name}</span>
                </span>
                <OptionSelect
                  options={options}
                  value={bucketValueOf(category)}
                  size="sm"
                  className="w-48 shrink-0"
                  ariaLabel={`Bucket for ${category.name}`}
                  onValueChange={(value) => {
                    setPicked((current) => ({ ...current, [category.id]: value }))
                    startTransition(() =>
                      assignCategoryToBucket(
                        category.id,
                        value === UNBUDGETED ? null : (value as CategoryPlacement),
                      ),
                    )
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  )
}
