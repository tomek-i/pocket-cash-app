import { Card, CardContent } from '@repo/ui'
import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import { amountClassName, formatMoney } from '@/lib/money'
import { listCategories } from '../../categories/actions'
import { listTags } from '../../tags/actions'
import { CategoryCell } from '../_components/category-cell'
import { TagsCell } from '../_components/tags-cell'
import { getTransaction } from '../actions'
import { DeleteTransactionButton } from './_components/delete-transaction-button'
import { DisplayNameField } from './_components/display-name-field'
import { SimilarTransactions } from './_components/similar-transactions'

export const metadata = { title: 'Transaction' }

export default async function TransactionDetailPage({
  params,
}: {
  params: Promise<{ transactionId: string }>
}) {
  const { transactionId } = await params
  const [tx, categories, tags] = await Promise.all([
    getTransaction(transactionId),
    listCategories(),
    listTags(),
  ])
  if (!tx) notFound()

  const title = tx.displayName ?? tx.description
  const hasRaw = Object.keys(tx.rawData).length > 0

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-5 py-5 lg:py-7">
      <Link
        href="/app/transactions"
        className="flex w-fit items-center gap-1 text-muted-foreground text-sm hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        Transactions
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="break-words font-semibold text-2xl tracking-tight">{title}</h1>
          <p className="text-muted-foreground text-sm">
            {tx.account.bank ? `${tx.account.bank.name} · ` : ''}
            {tx.account.name} · {tx.date}
          </p>
        </div>
        <p className={`font-semibold text-2xl tabular-nums ${amountClassName(tx.amount)}`}>
          {formatMoney(tx.amount, tx.currency)}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <Card className={hasRaw ? undefined : 'lg:col-span-2'}>
          <CardContent className="grid gap-4 p-5 sm:grid-cols-2">
            <DisplayNameField
              transactionId={tx.id}
              initialValue={tx.displayName}
              description={tx.description}
            />
            <Field label="Category">
              <CategoryCell transactionId={tx.id} category={tx.category} categories={categories} />
            </Field>
            <Field label="Tags">
              <TagsCell transactionId={tx.id} tags={tx.tags} allTags={tags} />
            </Field>
            <Field label="Date">{tx.date}</Field>
            {tx.valueDate ? <Field label="Value date">{tx.valueDate}</Field> : null}
            <Field label="Account">
              <Link
                href={`/app/banks/${tx.account.bankId}`}
                className="text-primary hover:underline"
              >
                {tx.account.name}
              </Link>
            </Field>
            {tx.merchant ? <Field label="Merchant">{tx.merchant}</Field> : null}
            {tx.reference ? <Field label="Reference">{tx.reference}</Field> : null}
            {tx.balance != null ? (
              <Field label="Balance">{formatMoney(tx.balance, tx.currency)}</Field>
            ) : null}
            {tx.notes ? <Field label="Notes">{tx.notes}</Field> : null}
            <Field label="Original description">{tx.description}</Field>
          </CardContent>
        </Card>

        {hasRaw ? (
          <Card>
            <CardContent className="p-5">
              <p className="mb-3 font-medium text-sm">Imported CSV row</p>
              <div className="overflow-hidden rounded-md border">
                <table className="w-full text-sm">
                  <tbody>
                    {Object.entries(tx.rawData).map(([key, value]) => (
                      <tr key={key} className="border-b last:border-0">
                        <td className="w-1/3 bg-muted/40 p-2 align-top font-medium text-muted-foreground text-xs">
                          {key}
                        </td>
                        <td className="break-words p-2 align-top">{value || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <SimilarTransactions transactionId={tx.id} categories={categories} tags={tags} />

      <div className="flex justify-end">
        <DeleteTransactionButton id={tx.id} label={title} />
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <p className="text-muted-foreground text-xs">{label}</p>
      <div className="text-sm">{children}</div>
    </div>
  )
}
