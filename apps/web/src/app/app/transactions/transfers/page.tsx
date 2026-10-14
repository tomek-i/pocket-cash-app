import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { prepareEmbeddedDatabase } from '@/lib/workspace'
import { listTransferSuggestions } from '../transfer-actions'
import { TransferReview } from './_components/transfer-review'

export const metadata = { title: 'Possible transfers' }

export default async function TransferSuggestionsPage() {
  await prepareEmbeddedDatabase()
  const suggestions = await listTransferSuggestions()

  return (
    <div className="flex flex-col gap-6 px-5 py-5 lg:px-8 lg:py-7">
      <Link
        href="/app/transactions"
        className="flex w-fit items-center gap-1 text-muted-foreground text-sm hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        Transactions
      </Link>
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">Possible transfers</h1>
        <p className="text-muted-foreground text-sm">
          Money that left one of your accounts and arrived in another. Confirmed transfers still
          count in your balances, but not as income or spending.
        </p>
      </div>
      <TransferReview suggestions={suggestions} />
    </div>
  )
}
