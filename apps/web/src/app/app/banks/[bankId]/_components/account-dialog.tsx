'use client'

import type { Branch } from '@repo/database'
import { ACCOUNT_TYPES, type AccountType } from '@repo/types'
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
import { Field } from '../../_components/form-field'
import type { ActionState } from '../../actions'
import { type AccountWithBranch, createAccount, updateAccount } from '../actions'

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  checking: 'Checking',
  savings: 'Savings',
  credit_card: 'Credit card',
  cash: 'Cash',
  investment: 'Investment',
  loan: 'Loan',
  other: 'Other',
}

export function AccountDialog({
  bankId,
  branches,
  account,
  defaultCurrency = 'USD',
  trigger,
}: {
  bankId: string
  branches: Branch[]
  account?: AccountWithBranch
  defaultCurrency?: string
  trigger: ReactElement
}) {
  const action = account ? updateAccount : createAccount
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (state?.ok) setOpen(false)
  }, [state])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{account ? 'Edit account' : 'Add account'}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="grid gap-4">
          <input type="hidden" name="bankId" value={bankId} />
          {account ? <input type="hidden" name="id" value={account.id} /> : null}

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

          {branches.length > 0 ? (
            <div className="grid gap-1.5">
              <Label htmlFor="branchId">Branch</Label>
              <Select
                name="branchId"
                defaultValue={state?.values?.branchId ?? account?.branchId ?? 'none'}
              >
                <SelectTrigger id="branchId">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No branch</SelectItem>
                  {branches.map((branch) => (
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
