'use client'

import type { Bank } from '@repo/database'
import { Avatar, AvatarFallback, Button, Card, CardHeader, CardTitle } from '@repo/ui'
import { Landmark, Pencil, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { BankDialog } from './bank-dialog'
import { DeleteBankDialog } from './delete-bank-dialog'

export function BankCard({ bank }: { bank: Bank }) {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-2">
        <Link href={`/app/banks/${bank.id}`} className="flex min-w-0 items-center gap-3">
          <Avatar className="size-9 rounded-lg">
            <AvatarFallback className="rounded-lg bg-primary/15 text-primary">
              <Landmark className="size-4" />
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <CardTitle className="truncate text-base">{bank.name}</CardTitle>
            <p className="text-muted-foreground text-xs">{bank.country ?? '—'}</p>
          </div>
        </Link>
        <div className="flex shrink-0 gap-1">
          <BankDialog
            bank={bank}
            trigger={
              <Button variant="ghost" size="icon" aria-label="Edit bank">
                <Pencil className="size-4" />
              </Button>
            }
          />
          <DeleteBankDialog
            bank={bank}
            trigger={
              <Button variant="ghost" size="icon" aria-label="Delete bank">
                <Trash2 className="size-4" />
              </Button>
            }
          />
        </div>
      </CardHeader>
    </Card>
  )
}
