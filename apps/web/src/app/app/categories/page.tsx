import { Badge, Button, Card, CardContent, cn } from '@repo/ui'
import { Pencil, Plus, Shapes, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { amountClassName, formatMoney } from '@/lib/money'
import { ConfirmDeleteDialog } from '../banks/[bankId]/_components/confirm-delete-dialog'
import { currentFy, fyBounds } from '../reports/queries'
import { getDefaultCurrency } from '../settings/actions'
import { CategoryDialog } from './_components/category-dialog'
import { CategoryIcon } from './_components/category-icon'
import { SeedDefaultsButton } from './_components/seed-defaults-button'
import { type CategorySort, deleteCategory, listCategoriesWithStats } from './actions'

export const metadata = { title: 'Categories' }

type Scope = 'all' | 'fy' | 'month'

const SCOPES: { value: Scope; label: string }[] = [
  { value: 'all', label: 'All time' },
  { value: 'fy', label: 'This FY' },
  { value: 'month', label: 'This month' },
]
const SORTS: { value: CategorySort; label: string }[] = [
  { value: 'name', label: 'Name' },
  { value: 'count', label: 'Activity' },
  { value: 'amount', label: 'Amount' },
]

/** Inclusive date bounds (YYYY-MM-DD) for a scope, or nothing for all-time. */
function scopeBounds(scope: Scope): { from?: string; to?: string; label: string } {
  if (scope === 'fy') {
    const { start, endInclusive } = fyBounds(currentFy())
    return { from: start, to: endInclusive, label: `FY${currentFy()}` }
  }
  if (scope === 'month') {
    const now = new Date()
    const y = now.getFullYear()
    const m = now.getMonth()
    const pad = (n: number) => String(n).padStart(2, '0')
    const last = new Date(y, m + 1, 0).getDate()
    return {
      from: `${y}-${pad(m + 1)}-01`,
      to: `${y}-${pad(m + 1)}-${pad(last)}`,
      label: 'this month',
    }
  }
  return { label: 'all time' }
}

/** A segmented row of links that swap one search param, preserving the other. */
function Segmented<T extends string>({
  options,
  current,
  hrefFor,
}: {
  options: { value: T; label: string }[]
  current: T
  hrefFor: (value: T) => string
}) {
  return (
    <div className="inline-flex rounded-lg border bg-muted/40 p-0.5">
      {options.map((opt) => (
        <Link
          key={opt.value}
          href={hrefFor(opt.value)}
          className={cn(
            'rounded-md px-2.5 py-1 font-medium text-xs transition-colors',
            opt.value === current
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {opt.label}
        </Link>
      ))}
    </div>
  )
}

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string; sort?: string }>
}) {
  const params = await searchParams
  const scope: Scope = SCOPES.some((s) => s.value === params.scope)
    ? (params.scope as Scope)
    : 'all'
  const sort: CategorySort = SORTS.some((s) => s.value === params.sort)
    ? (params.sort as CategorySort)
    : 'name'
  const bounds = scopeBounds(scope)

  const [categories, currency] = await Promise.all([
    listCategoriesWithStats({ from: bounds.from, to: bounds.to, sort }),
    getDefaultCurrency(),
  ])

  const buildHref = (next: { scope?: Scope; sort?: CategorySort }) => {
    const sp = new URLSearchParams()
    const s = next.scope ?? scope
    const o = next.sort ?? sort
    if (s !== 'all') sp.set('scope', s)
    if (o !== 'name') sp.set('sort', o)
    const qs = sp.toString()
    return qs ? `/app/categories?${qs}` : '/app/categories'
  }

  /** Link a category's count into its filtered transactions, carrying the scope. */
  const txnHref = (categoryId: string) => {
    const sp = new URLSearchParams({ category: categoryId })
    if (bounds.from) sp.set('from', bounds.from)
    if (bounds.to) sp.set('to', bounds.to)
    return `/app/transactions?${sp.toString()}`
  }

  return (
    <div className="flex flex-col gap-6 px-5 py-5 lg:px-8 lg:py-7">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-semibold text-2xl tracking-tight">Categories</h1>
          <p className="text-muted-foreground text-sm">Group transactions by what they're for.</p>
        </div>
        <CategoryDialog
          trigger={
            <Button className="gap-2">
              <Plus className="size-4" />
              Add category
            </Button>
          }
        />
      </div>

      {categories.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-3 p-12 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <Shapes className="size-6" />
          </div>
          <div>
            <p className="font-medium">No categories yet</p>
            <p className="text-muted-foreground text-sm">
              Start with a ready-made set, or add your own.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <SeedDefaultsButton />
            <CategoryDialog
              trigger={
                <Button variant="outline" className="gap-2">
                  <Plus className="size-4" />
                  Add category
                </Button>
              }
            />
          </div>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-muted-foreground text-sm">
              Showing stats for <span className="font-medium text-foreground">{bounds.label}</span>.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Segmented
                options={SCOPES}
                current={scope}
                hrefFor={(value) => buildHref({ scope: value })}
              />
              <Segmented
                options={SORTS}
                current={sort}
                hrefFor={(value) => buildHref({ sort: value })}
              />
            </div>
          </div>
          <div className="grid gap-2">
            {categories.map((category) => (
              <Card key={category.id}>
                <CardContent className="flex items-center justify-between gap-3 p-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className="flex size-9 shrink-0 items-center justify-center rounded-lg"
                      style={{
                        backgroundColor: category.color ? `${category.color}1a` : 'var(--muted)',
                      }}
                    >
                      <CategoryIcon
                        name={category.icon}
                        color={category.color}
                        className="size-4"
                      />
                    </span>
                    <p className="min-w-0 truncate font-medium text-sm">{category.name}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {category.transactionCount > 0 ? (
                      <div className="mr-1 hidden items-center gap-1.5 sm:flex">
                        <Link href={txnHref(category.id)} title="View these transactions">
                          <Badge
                            variant="secondary"
                            className="tabular-nums transition-colors hover:bg-secondary/70"
                          >
                            {category.transactionCount} txn
                            {category.transactionCount === 1 ? '' : 's'}
                          </Badge>
                        </Link>
                        <Badge
                          variant="outline"
                          className={cn('tabular-nums', amountClassName(category.totalAmount))}
                        >
                          {formatMoney(category.totalAmount, currency)}
                        </Badge>
                      </div>
                    ) : (
                      <Badge
                        variant="outline"
                        className="mr-1 hidden text-muted-foreground sm:inline-flex"
                      >
                        No transactions
                      </Badge>
                    )}
                    <CategoryDialog
                      category={category}
                      trigger={
                        <Button variant="ghost" size="icon" aria-label="Edit category">
                          <Pencil className="size-4" />
                        </Button>
                      }
                    />
                    <ConfirmDeleteDialog
                      action={deleteCategory}
                      hidden={{ id: category.id }}
                      title={`Delete “${category.name}”?`}
                      description="Transactions keep their data but lose this category link."
                      trigger={
                        <Button variant="ghost" size="icon" aria-label="Delete category">
                          <Trash2 className="size-4" />
                        </Button>
                      }
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
