import { Card, CardContent, Skeleton } from '@repo/ui'

const ROWS = ['a', 'b', 'c', 'd', 'e', 'f']

/** Placeholder for the review list while suggestions are being worked out. */
export function CategorizeSkeleton() {
  return (
    <Card aria-busy="true" aria-label="Loading suggestions">
      <CardContent className="flex flex-col gap-3 p-4">
        <Skeleton className="h-14 w-full" />
        <div className="flex flex-col divide-y">
          {ROWS.map((row) => (
            <div key={row} className="flex flex-wrap items-center gap-3 py-2.5">
              <Skeleton className="size-4 shrink-0" />
              <div className="flex min-w-0 flex-1 basis-52 flex-col gap-1.5">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-8 w-44" />
              <Skeleton className="h-8 w-44" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
