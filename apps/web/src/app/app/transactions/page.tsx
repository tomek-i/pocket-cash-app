import { Card } from '@repo/ui'
import { ArrowLeftRight } from 'lucide-react'
import { parseAmountToMinor } from '@/lib/money'
import { Empty } from '../_components/empty'
import { Pagination } from '../_components/pagination'
import { listAllAccounts } from '../accounts/actions'
import { listCategories } from '../categories/actions'
import { listTags } from '../tags/actions'
import { type FilterAccount, TransactionFilters } from './_components/transaction-filters'
import { TransactionsTable } from './_components/transactions-table'
import { listTransactions } from './actions'

export const metadata = { title: 'Transactions' }

interface SearchParams {
  account?: string
  q?: string
  from?: string
  to?: string
  category?: string
  min?: string
  max?: string
  page?: string
}

function buildHref(params: SearchParams, page: number): string {
  const sp = new URLSearchParams()
  if (params.account) sp.set('account', params.account)
  if (params.q) sp.set('q', params.q)
  if (params.from) sp.set('from', params.from)
  if (params.to) sp.set('to', params.to)
  if (params.category) sp.set('category', params.category)
  if (params.min) sp.set('min', params.min)
  if (params.max) sp.set('max', params.max)
  if (page > 1) sp.set('page', String(page))
  const qs = sp.toString()
  return qs ? `/app/transactions?${qs}` : '/app/transactions'
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const page = Math.max(1, Number(params.page) || 1)

  const amountMin = parseAmountToMinor(params.min)
  const amountMax = parseAmountToMinor(params.max)

  const [data, accounts, categories, tags] = await Promise.all([
    listTransactions({
      accountId: params.account,
      q: params.q,
      from: params.from,
      to: params.to,
      category: params.category,
      amountMin,
      amountMax,
      page,
    }),
    listAllAccounts(),
    listCategories(),
    listTags(),
  ])

  const filterAccounts: FilterAccount[] = accounts.map((a) => ({
    id: a.id,
    label: `${a.bank.name} · ${a.name}`,
  }))

  return (
    <div className="flex flex-col gap-6 px-5 py-5 lg:px-8 lg:py-7">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">Transactions</h1>
        <p className="text-muted-foreground text-sm">
          Everything imported across your accounts. Categorise and tag inline.
        </p>
      </div>

      <TransactionFilters
        accounts={filterAccounts}
        categories={categories}
        current={{
          accountId: params.account,
          q: params.q,
          from: params.from,
          to: params.to,
          category: params.category,
          amountMin: params.min,
          amountMax: params.max,
        }}
      />

      {data.total === 0 ? (
        <Card>
          <Empty
            className="p-12"
            icon={ArrowLeftRight}
            title="No transactions found"
            description={
              accounts.length === 0
                ? 'Import a CSV statement into an account to see transactions here.'
                : 'Try adjusting or clearing your filters.'
            }
          />
        </Card>
      ) : (
        <TransactionsTable rows={data.rows} categories={categories} tags={tags} />
      )}

      <Pagination
        page={data.page}
        pageSize={data.pageSize}
        total={data.total}
        hrefFor={(p) => buildHref(params, p)}
      />
    </div>
  )
}
