'use client'

import type { Bank, Branch } from '@repo/database'
import { ACCOUNT_TYPES } from '@repo/types'
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui'
import { type ReactElement, useActionState, useEffect, useState } from 'react'
import { Field } from '../../banks/_components/form-field'
import { ACCOUNT_TYPE_LABELS } from '../../banks/[bankId]/_components/account-dialog'
import { createAccount, updateAccount } from '../../banks/[bankId]/actions'
import type { ActionState } from '../../banks/actions'
import type { AccountWithBankBranch } from '../actions'

/**
 * Create/edit an account from the top-level Accounts page. Unlike the bank-scoped
 * dialog this one carries a Bank selector, and filters the Branch options to the
 * chosen bank (resetting the branch when the bank changes).
 */
export function AccountFormDialog({
  banks,
  branches,
  account,
  defaultCurrency = 'USD',
  trigger,
}: {
  banks: Bank[]
  branches: Branch[]
  account?: AccountWithBankBranch
  defaultCurrency?: string
  trigger: ReactElement
}) {
  const action = account ? updateAccount : createAccount
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, null)
  const [open, setOpen] = useState(false)
  const [bankId, setBankId] = useState(
    state?.values?.bankId ?? account?.bankId ?? banks[0]?.id ?? '',
  )

  useEffect(() => {
    if (state?.ok) setOpen(false)
  }, [state])

  const branchesForBank = branches.filter((b) => b.bankId === bankId)
  // When editing the same bank, preselect the account's branch; otherwise none.
  const defaultBranchId =
    account && account.bankId === bankId ? (account.branchId ?? 'none') : 'none'

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{account ? 'Edit account' : 'Add account'}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="grid gap-4">
          {account ? <input type="hidden" name="id" value={account.id} /> : null}

          <div className="grid gap-1.5">
            <Label htmlFor="bankId">Bank</Label>
            <Select name="bankId" value={bankId} onValueChange={(v) => setBankId(v ?? '')}>
              <SelectTrigger id="bankId">
                <SelectValue placeholder="Select a bank" />
              </SelectTrigger>
              <SelectContent>
                {banks.map((bank) => (
                  <SelectItem key={bank.id} value={bank.id}>
                    {bank.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {state?.errors?.bankId?.[0] ? (
              <p className="text-destructive text-xs">{state.errors.bankId[0]}</p>
            ) : null}
          </div>

          <Field
            label="Name"
            name="name"
            defaultValue={state?.values?.name ?? account?.name ?? ''}
            placeholder="Current account"
            error={state?.errors?.name}
          />

          <div className="grid gap-1.5">
            <Label htmlFor="type">Type</Label>
            <Select name="type" defaultValue={state?.values?.type ?? account?.type ?? 'checking'}>
              <SelectTrigger id="type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACCOUNT_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {ACCOUNT_TYPE_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Field
            label="Currency"
            name="currency"
            defaultValue={state?.values?.currency ?? account?.currency ?? defaultCurrency}
            placeholder="USD"
            error={state?.errors?.currency}
          />

          {branchesForBank.length > 0 ? (
            <div className="grid gap-1.5">
              <Label htmlFor="branchId">Branch</Label>
              {/* key resets the select to its default when the bank changes */}
              <Select key={bankId} name="branchId" defaultValue={defaultBranchId}>
                <SelectTrigger id="branchId">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No branch</SelectItem>
                  {branchesForBank.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : account ? 'Save changes' : 'Add account'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
