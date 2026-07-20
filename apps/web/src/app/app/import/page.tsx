import { Avatar, AvatarFallback, Button, Card, CardContent } from '@repo/ui'
import { Landmark, Plus, Upload, Wallet } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { listAllAccounts } from '../accounts/actions'

export const metadata = { title: 'Import CSV' }

const importHref = (bankId: string, accountId: string) =>
  `/app/banks/${bankId}/accounts/${accountId}/import`

export default async function ImportPage() {
  const accounts = await listAllAccounts()

  // Smart jump: with exactly one account, skip the picker entirely.
  const only = accounts.length === 1 ? accounts[0] : undefined
  if (only) redirect(importHref(only.bankId, only.id))

  return (
    <div className="flex flex-col gap-6 px-5 py-5 lg:px-8 lg:py-7">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">Import CSV</h1>
        <p className="text-muted-foreground text-sm">
          Choose the account to import a statement into.
        </p>
      </div>

      {accounts.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-3 p-12 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <Landmark className="size-6" />
          </div>
          <div>
            <p className="font-medium">No accounts yet</p>
            <p className="text-muted-foreground text-sm">
              Add a bank and an account before importing a statement.
            </p>
          </div>
          <Link href="/app/accounts">
            <Button className="gap-2">
              <Plus className="size-4" />
              Add account
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="grid gap-2">
          {accounts.map((account) => (
            <Link key={account.id} href={importHref(account.bankId, account.id)}>
              <Card className="transition-colors hover:bg-muted/40">
                <CardContent className="flex items-center justify-between gap-3 p-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar className="size-9 rounded-lg">
                      <AvatarFallback className="rounded-lg bg-primary/15 text-primary">
                        <Wallet className="size-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-sm">{account.name}</p>
                      <p className="truncate text-muted-foreground text-xs">
                        {account.bank.name} · {account.currency}
                      </p>
                    </div>
                  </div>
                  <Upload className="size-4 shrink-0 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
