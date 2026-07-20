import { accounts, db, eq } from '@repo/database'
import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ImportWizard } from './_components/import-wizard'
import { listMappings } from './actions'

export const metadata = { title: 'Import CSV' }

export default async function ImportPage({
  params,
}: {
  params: Promise<{ bankId: string; accountId: string }>
}) {
  const { bankId, accountId } = await params
  const account = await db.query.accounts.findFirst({
    where: eq(accounts.id, accountId),
    with: { bank: true },
  })
  if (!account || account.bankId !== bankId) notFound()

  const mappings = await listMappings(bankId)

  return (
    <div className="flex flex-col gap-6 px-5 py-5 lg:px-8 lg:py-7">
      <div className="flex flex-col gap-2">
        <Link
          href={`/app/banks/${bankId}`}
          className="flex w-fit items-center gap-1 text-muted-foreground text-sm hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          {account.bank.name}
        </Link>
        <h1 className="font-semibold text-2xl tracking-tight">Import into {account.name}</h1>
        <p className="text-muted-foreground text-sm">
          Map your bank's CSV columns once, save it, and reuse it next time.
        </p>
      </div>

      <ImportWizard
        bankId={bankId}
        account={{ id: account.id, name: account.name, currency: account.currency }}
        savedMappings={mappings}
      />
    </div>
  )
}
