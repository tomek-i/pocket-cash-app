import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { isAiConfigured } from '../../../settings/actions'
import { currentFy, fyRangeLabel } from '../../queries'
import { TaxCandidateFinder } from './_components/tax-candidate-finder'

export const metadata = { title: 'Tax review' }

export default async function TaxReviewPage({ params }: { params: Promise<{ fy: string }> }) {
  const { fy: fyStr } = await params
  const fy = Number(fyStr)
  if (!Number.isInteger(fy) || fy < 1970 || fy > currentFy() + 1) notFound()

  const aiConfigured = await isAiConfigured()

  return (
    <div className="flex flex-col gap-6 px-5 py-5 lg:px-8 lg:py-7">
      <div className="flex flex-col gap-2">
        <Link
          href={`/app/reports/${fy}`}
          className="flex w-fit items-center gap-1 text-muted-foreground text-sm hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          FY{fy}
        </Link>
        <div>
          <h1 className="font-semibold text-2xl tracking-tight">Tax review · FY{fy}</h1>
          <p className="text-muted-foreground text-sm">
            {fyRangeLabel(fy)} — scan this financial year for possibly tax-relevant transactions and
            tag them for your return.
          </p>
        </div>
      </div>

      <TaxCandidateFinder fy={fy} aiConfigured={aiConfigured} />
    </div>
  )
}
