import type { Category, Tag } from '@repo/database'
import { Card } from '@repo/ui'
import type { TransactionRow as TxRow } from '../actions'
import { TransactionRow } from './transaction-row'

/** The transactions table (used on the Transactions page and FY report). */
export function TransactionsTable({
  rows,
  categories,
  tags,
  backHref,
}: {
  rows: TxRow[]
  categories: Pick<Category, 'id' | 'name' | 'color' | 'icon'>[]
  tags: Pick<Tag, 'id' | 'name' | 'color'>[]
  /**
   * This page's own URL, filters and page number included, so a row can carry it
   * to the detail page and the back link can return to exactly here.
   */
  backHref: string
}) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-muted-foreground">
            <tr>
              <th className="whitespace-nowrap p-3 text-left font-medium">Date</th>
              <th className="p-3 text-left font-medium">Description</th>
              <th className="p-3 text-left font-medium">Category</th>
              <th className="p-3 text-left font-medium">Tags</th>
              <th className="whitespace-nowrap p-3 text-right font-medium">Amount</th>
              <th className="p-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((tx) => (
              <TransactionRow
                key={tx.id}
                tx={tx}
                categories={categories}
                tags={tags}
                backHref={backHref}
              />
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
