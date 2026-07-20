import { Avatar, AvatarFallback, Badge, Button, Card, CardContent } from '@repo/ui'
import { Landmark, Pencil, Plus, Trash2, Upload, Wallet } from 'lucide-react'
import Link from 'next/link'
import { ACCOUNT_TYPE_LABELS } from '../banks/[bankId]/_components/account-dialog'
import { ConfirmDeleteDialog } from '../banks/[bankId]/_components/confirm-delete-dialog'
import { deleteAccount } from '../banks/[bankId]/actions'
import { listBanks } from '../banks/actions'
import { getDefaultCurrency } from '../settings/actions'
import { AccountFormDialog } from './_components/account-form-dialog'
import { listAllAccounts, listAllBranches } from './actions'

export const metadata = { title: 'Accounts' }

export default async function AccountsPage() {
  const [accounts, banks, branches, defaultCurrency] = await Promise.all([
    listAllAccounts(),
    listBanks(),
    listAllBranches(),
    getDefaultCurrency(),
  ])

  const hasBanks = banks.length > 0

  return (
    <div className="flex flex-col gap-6 px-5 py-5 lg:px-8 lg:py-7">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-semibold text-2xl tracking-tight">Accounts</h1>
          <p className="text-muted-foreground text-sm">Every account across your banks.</p>
        </div>
        {hasBanks ? (
          <AccountFormDialog
            banks={banks}
            branches={branches}
            defaultCurrency={defaultCurrency}
            trigger={
              <Button className="gap-2">
                <Plus className="size-4" />
                Add account
              </Button>
            }
          />
        ) : null}
      </div>

      {!hasBanks ? (
        <Card className="flex flex-col items-center justify-center gap-3 p-12 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <Landmark className="size-6" />
          </div>
          <div>
            <p className="font-medium">Add a bank first</p>
            <p className="text-muted-foreground text-sm">
              Accounts belong to a bank. Create an institution to get started.
            </p>
          </div>
          <Link href="/app/banks">
            <Button className="gap-2">
              <Plus className="size-4" />
              Add bank
            </Button>
          </Link>
        </Card>
      ) : accounts.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-3 p-12 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <Wallet className="size-6" />
          </div>
          <div>
            <p className="font-medium">No accounts yet</p>
            <p className="text-muted-foreground text-sm">
              Add an account to import statements into.
            </p>
          </div>
          <AccountFormDialog
            banks={banks}
            branches={branches}
            defaultCurrency={defaultCurrency}
            trigger={
              <Button className="gap-2">
                <Plus className="size-4" />
                Add account
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-2">
          {accounts.map((account) => (
            <Card key={account.id}>
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
                      <Link href={`/app/banks/${account.bankId}`} className="hover:text-foreground">
                        {account.bank.name}
                      </Link>
                      {` · ${account.currency}`}
                      {account.branch ? ` · ${account.branch.name}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant="secondary">{ACCOUNT_TYPE_LABELS[account.type]}</Badge>
                  <Link href={`/app/banks/${account.bankId}/accounts/${account.id}/import`}>
                    <Button variant="ghost" size="icon" aria-label="Import CSV">
                      <Upload className="size-4" />
                    </Button>
                  </Link>
                  <AccountFormDialog
                    banks={banks}
                    branches={branches}
                    defaultCurrency={defaultCurrency}
                    account={account}
                    trigger={
                      <Button variant="ghost" size="icon" aria-label="Edit account">
                        <Pencil className="size-4" />
                      </Button>
                    }
                  />
                  <ConfirmDeleteDialog
                    action={deleteAccount}
                    hidden={{ id: account.id, bankId: account.bankId }}
                    title={`Delete “${account.name}”?`}
                    description="This removes the account and all its transactions."
                    trigger={
                      <Button variant="ghost" size="icon" aria-label="Delete account">
                        <Trash2 className="size-4" />
                      </Button>
                    }
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
