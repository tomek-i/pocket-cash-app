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
  OptionSelect,
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
            <OptionSelect
              id="type"
              name="type"
              defaultValue={state?.values?.type ?? account?.type ?? 'checking'}
              options={ACCOUNT_TYPES.map((type) => ({
                value: type,
                label: ACCOUNT_TYPE_LABELS[type],
              }))}
            />
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
              <OptionSelect
                id="branchId"
                name="branchId"
                defaultValue={state?.values?.branchId ?? account?.branchId ?? 'none'}
                options={[
                  { value: 'none', label: 'No branch' },
                  ...branches.map((branch) => ({ value: branch.id, label: branch.name })),
                ]}
              />
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
