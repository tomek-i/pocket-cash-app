'use client'

import { Button } from '@repo/ui'
import { Download, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { exportTransactionsCsv, type TransactionFilters } from '../../../transactions/actions'

/**
 * Downloads the transactions matching `filters` as a CSV file. Fetches the rows
 * on click via the server action, so nothing is loaded until the user asks.
 */
export function ExportTransactionsButton({
  filters,
  filename,
  label = 'Export CSV',
  variant = 'outline',
  className,
}: {
  filters: TransactionFilters
  filename: string
  label?: string
  variant?: 'outline' | 'ghost' | 'secondary'
  className?: string
}) {
  const [pending, setPending] = useState(false)

  const onClick = async () => {
    if (pending) return
    setPending(true)
    try {
      const csv = await exportTransactionsCsv(filters)
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setPending(false)
    }
  }

  return (
    <Button
      variant={variant}
      size="sm"
      className={className ?? 'h-8 gap-1.5'}
      onClick={onClick}
      disabled={pending}
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
      {label}
    </Button>
  )
}
