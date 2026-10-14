import { Skeleton } from '@repo/ui'
import { CategorizeSkeleton } from './_components/categorize-skeleton'

export default function CategorizeLoading() {
  return (
    <div className="flex flex-col gap-6 px-5 py-5 lg:px-8 lg:py-7">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      <CategorizeSkeleton />
    </div>
  )
}
