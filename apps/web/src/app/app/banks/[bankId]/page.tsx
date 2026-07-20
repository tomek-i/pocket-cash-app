import { Avatar, AvatarFallback, Badge, Button, Card, CardContent } from '@repo/ui'
import { ChevronLeft, Pencil, Plus, Trash2, Upload, Wallet } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getDefaultCurrency } from '../../settings/actions'
import { getBank } from '../actions'
import { ACCOUNT_TYPE_LABELS, AccountDialog } from './_components/account-dialog'
import { BranchDialog } from './_components/branch-dialog'
import { ConfirmDeleteDialog } from './_components/confirm-delete-dialog'
import { deleteAccount, deleteBranch, listAccounts, listBranches } from './actions'

export default async function BankDetailPage({ params }: { params: Promise<{ bankId: string }> }) {
  const { bankId } = await params
  const bank = await getBank(bankId)
  if (!bank) notFound()

  const [branches, accounts, defaultCurrency] = await Promise.all([
    listBranches(bankId),
    listAccounts(bankId),
    getDefaultCurrency(),
  ])

  return (
    <div className="flex flex-col gap-8 px-5 py-5 lg:px-8 lg:py-7">
      <div className="flex flex-col gap-2">
        <Link
          href="/app/banks"
          className="flex w-fit items-center gap-1 text-muted-foreground text-sm hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          Banks
        </Link>
        <h1 className="font-semibold text-2xl tracking-tight">{bank.name}</h1>
      </div>

      {/* Branches */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-lg">Branches</h2>
            <p className="text-muted-foreground text-sm">Optional — only if you track them.</p>
          </div>
          <BranchDialog
            bankId={bankId}
            trigger={
              <Button variant="outline" size="sm" className="gap-2">
                <Plus className="size-4" />
                Add branch
              </Button>
            }
          />
        </div>

        {branches.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-center text-muted-foreground text-sm">
            No branches yet.
          </p>
        ) : (
          <div className="grid gap-2">
            {branches.map((branch) => (
              <Card key={branch.id}>
                <CardContent className="flex items-center justify-between gap-2 p-4">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-sm">{branch.name}</p>
                    <p className="truncate text-muted-foreground text-xs">
                      {[branch.sortCode, branch.routingNumber].filter(Boolean).join(' · ') || '—'}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <BranchDialog
                      bankId={bankId}
                      branch={branch}
                      trigger={
                        <Button variant="ghost" size="icon" aria-label="Edit branch">
                          <Pencil className="size-4" />
                        </Button>
                      }
                    />
                    <ConfirmDeleteDialog
                      action={deleteBranch}
                      hidden={{ id: branch.id, bankId }}
                      title={`Delete “${branch.name}”?`}
                      description="Accounts keep their data but lose this branch link."
                      trigger={
                        <Button variant="ghost" size="icon" aria-label="Delete branch">
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
      </section>

      {/* Accounts */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">Accounts</h2>
          <AccountDialog
            bankId={bankId}
            branches={branches}
            defaultCurrency={defaultCurrency}
            trigger={
              <Button size="sm" className="gap-2">
                <Plus className="size-4" />
                Add account
              </Button>
            }
          />
        </div>

        {accounts.length === 0 ? (
          <Card className="flex flex-col items-center justify-center gap-3 p-10 text-center">
            <div className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <Wallet className="size-6" />
            </div>
            <div>
              <p className="font-medium">No accounts yet</p>
              <p className="text-muted-foreground text-sm">
                Add an account to import statements into.
              </p>
            </div>
            <AccountDialog
              bankId={bankId}
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
                        {account.currency}
                        {account.branch ? ` · ${account.branch.name}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant="secondary">{ACCOUNT_TYPE_LABELS[account.type]}</Badge>
                    <Link href={`/app/banks/${bankId}/accounts/${account.id}/import`}>
                      <Button variant="ghost" size="icon" aria-label="Import CSV">
                        <Upload className="size-4" />
                      </Button>
                    </Link>
                    <AccountDialog
                      bankId={bankId}
                      branches={branches}
                      account={account}
                      trigger={
                        <Button variant="ghost" size="icon" aria-label="Edit account">
                          <Pencil className="size-4" />
                        </Button>
                      }
                    />
                    <ConfirmDeleteDialog
                      action={deleteAccount}
                      hidden={{ id: account.id, bankId }}
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
      </section>
    </div>
  )
}
