'use client'

import type { Category, Tag } from '@repo/database'
import { Card } from '@repo/ui'
import { useState } from 'react'
import type { TransactionRow as TxRow } from '../actions'
import { BulkActionBar } from './bulk-action-bar'
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
  const [selected, setSelected] = useState<Set<string>>(new Set())
  // Only rows on this page can be selected. After a page change, a filter or a
  // delete, ids that are no longer shown drop out of the selection.
  const visible = rows.filter((r) => selected.has(r.id)).map((r) => r.id)
  const allSelected = rows.length > 0 && visible.length === rows.length

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))

  return (
    <Card className="overflow-hidden p-0">
      {visible.length > 0 ? (
        <BulkActionBar
          ids={visible}
          categories={categories}
          tags={tags}
          onDone={() => setSelected(new Set())}
        />
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-muted-foreground">
            <tr>
              <th className="w-10 p-3">
                <input
                  type="checkbox"
                  className="size-4 align-middle accent-primary"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Select all transactions on this page"
                />
              </th>
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
                selected={selected.has(tx.id)}
                onToggle={() => toggle(tx.id)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
