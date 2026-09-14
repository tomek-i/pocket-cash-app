import { Button, cn, Input } from '@repo/ui'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { GAP, type PageSize, pageCount, pageRange, paginationItems } from '../_lib/pagination'
import { RememberPageSize } from './page-controls'

/**
 * Server-rendered pager: numbered pages, a jump box and a rows-per-page control.
 *
 * It used to be prev and next only, sitting below the table. Reaching page 30 of
 * a few thousand transactions took twenty-nine clicks, each one after scrolling
 * back to the bottom of a full page of rows.
 *
 * Every page number is a real `<Link>` rather than a button, so middle-click and
 * open-in-new-tab work, and the two controls that need state are the only thing
 * that ships JS.
 */
export function Pagination({
  page,
  pageSize,
  total,
  hrefFor,
  sizeOptions,
  preferredSize,
  jump,
  /**
   * The pager above the list drops the summary line and the jump box: repeating
   * them top and bottom is noise, and the top copy is there to move pages, not to
   * restate what is already about to be visible.
   */
  compact = false,
}: {
  page: number
  pageSize: number
  total: number
  hrefFor: (page: number) => string
  /** One href per offered size, built by the page that owns the filters. */
  sizeOptions?: { size: PageSize; href: string }[]
  /** The stored default, so an explicit choice can be told from simply landing here. */
  preferredSize?: PageSize
  /**
   * Where a "go to page" form should submit, and the filters to carry with it.
   *
   * A plain GET form rather than a client component: the browser already knows
   * how to turn a form into a query string, so this control needs no JavaScript
   * at all and keeps working before hydration.
   */
  jump?: { action: string; hidden: Record<string, string> }
  compact?: boolean
}) {
  if (total === 0) return null

  const totalPages = pageCount(total, pageSize)
  const { first, last } = pageRange(page, pageSize, total)
  const items = paginationItems(page, totalPages)
  // Nothing to page through, and no size worth changing on a list this short.
  if (totalPages === 1 && !sizeOptions) return null

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-between gap-3 text-muted-foreground text-sm"
    >
      <div className="flex flex-wrap items-center gap-3">
        {compact ? null : (
          <p>
            {first}&ndash;{last} of {total}
          </p>
        )}
        {sizeOptions ? (
          <div className="flex items-center gap-1">
            <span aria-hidden className="text-xs">
              Rows
            </span>
            <ul aria-label="Rows per page" className="flex list-none items-center gap-0.5 p-0">
              {sizeOptions.map((option) => (
                <li key={option.size}>
                  <Button
                    variant={option.size === pageSize ? 'default' : 'ghost'}
                    size="sm"
                    nativeButton={false}
                    aria-current={option.size === pageSize ? 'true' : undefined}
                    aria-label={`${option.size} rows per page`}
                    className={cn(
                      'h-8 min-w-9 px-2 tabular-nums',
                      option.size === pageSize && 'font-medium',
                    )}
                    render={option.size === pageSize ? <span /> : <Link href={option.href} />}
                  >
                    {option.size}
                  </Button>
                </li>
              ))}
            </ul>
            {preferredSize ? <RememberPageSize size={pageSize} preferred={preferredSize} /> : null}
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {totalPages > 1 ? (
          <>
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              disabled={page <= 1}
              nativeButton={false}
              aria-label="Previous page"
              render={page <= 1 ? <span /> : <Link href={hrefFor(page - 1)} />}
            >
              <ChevronLeft className="size-4" />
              <span className="sr-only sm:not-sr-only">Prev</span>
            </Button>

            <ul className="flex list-none items-center gap-1 p-0">
              {items.map((item, index) =>
                item === GAP ? (
                  // Two gaps can appear, so the index is what tells them apart.
                  // biome-ignore lint/suspicious/noArrayIndexKey: a gap has no identity of its own
                  <li key={`gap-${index}`} aria-hidden className="px-1 text-xs">
                    &hellip;
                  </li>
                ) : (
                  <li key={item}>
                    <Button
                      variant={item === page ? 'default' : 'ghost'}
                      size="sm"
                      nativeButton={false}
                      aria-label={`Page ${item}`}
                      aria-current={item === page ? 'page' : undefined}
                      className={cn(
                        'h-8 min-w-8 px-2 tabular-nums',
                        item === page && 'font-medium',
                      )}
                      render={item === page ? <span /> : <Link href={hrefFor(item)} />}
                    >
                      {item}
                    </Button>
                  </li>
                ),
              )}
            </ul>

            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              disabled={page >= totalPages}
              nativeButton={false}
              aria-label="Next page"
              render={page >= totalPages ? <span /> : <Link href={hrefFor(page + 1)} />}
            >
              <span className="sr-only sm:not-sr-only">Next</span>
              <ChevronRight className="size-4" />
            </Button>
          </>
        ) : null}

        {/* Only worth a jump box once the numbers stop showing every page. */}
        {!compact && jump && totalPages > 7 ? (
          <form action={jump.action} method="get" className="flex items-center gap-1.5">
            {Object.entries(jump.hidden).map(([name, value]) => (
              <input key={name} type="hidden" name={name} value={value} />
            ))}
            <Input
              name="page"
              type="number"
              min={1}
              max={totalPages}
              inputMode="numeric"
              placeholder="Page"
              aria-label={`Go to page, 1 to ${totalPages}`}
              className="h-8 w-20"
            />
            <Button type="submit" variant="outline" size="sm">
              Go
            </Button>
          </form>
        ) : null}
      </div>
    </nav>
  )
}
