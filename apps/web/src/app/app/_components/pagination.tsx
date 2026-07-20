import { Button } from '@repo/ui'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'

/** Server-rendered prev/next pager. `hrefFor(page)` builds each page's URL. */
export function Pagination({
  page,
  pageSize,
  total,
  hrefFor,
}: {
  page: number
  pageSize: number
  total: number
  hrefFor: (page: number) => string
}) {
  if (total === 0) return null
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const first = (page - 1) * pageSize + 1
  const last = Math.min(page * pageSize, total)

  return (
    <div className="flex items-center justify-between text-muted-foreground text-sm">
      <p>
        {first}–{last} of {total}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="gap-1"
          disabled={page <= 1}
          nativeButton={false}
          render={page <= 1 ? <span /> : <Link href={hrefFor(page - 1)} />}
        >
          <ChevronLeft className="size-4" />
          Prev
        </Button>
        <span className="text-xs">
          Page {page} / {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="gap-1"
          disabled={page >= totalPages}
          nativeButton={false}
          render={page >= totalPages ? <span /> : <Link href={hrefFor(page + 1)} />}
        >
          Next
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}
