'use server'

import { type Account, accounts, asc, type Branch, banks, branches, db, eq } from '@repo/database'
import {
  createAccountSchema,
  createBranchSchema,
  updateAccountSchema,
  updateBranchSchema,
} from '@repo/validation'
import { revalidatePath } from 'next/cache'
import type { ActionState } from '../actions'

async function bankExists(bankId: string): Promise<boolean> {
  const row = await db.query.banks.findFirst({
    where: eq(banks.id, bankId),
    columns: { id: true },
  })
  return Boolean(row)
}

const revalidateBank = (bankId: string) => revalidatePath(`/app/banks/${bankId}`)

// Account mutations surface both on the bank detail page and the top-level
// /app/accounts list, so refresh both.
const revalidateAccountViews = (bankId: string) => {
  revalidatePath(`/app/banks/${bankId}`)
  revalidatePath('/app/accounts')
}

// ── Branches ─────────────────────────────────────────────────────────────────

export async function listBranches(bankId: string): Promise<Branch[]> {
  return db.select().from(branches).where(eq(branches.bankId, bankId)).orderBy(asc(branches.name))
}

export async function createBranch(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = {
    name: String(formData.get('name') ?? ''),
    sortCode: String(formData.get('sortCode') ?? ''),
    routingNumber: String(formData.get('routingNumber') ?? ''),
  }
  const parsed = createBranchSchema.safeParse({ bankId: formData.get('bankId'), ...values })
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors, values }
  if (!(await bankExists(parsed.data.bankId)))
    return { errors: { bankId: ['Unknown bank'] }, values }

  await db.insert(branches).values({
    bankId: parsed.data.bankId,
    name: parsed.data.name,
    sortCode: parsed.data.sortCode ?? null,
    routingNumber: parsed.data.routingNumber ?? null,
  })
  revalidateBank(parsed.data.bankId)
  return { ok: true }
}

export async function updateBranch(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = {
    name: String(formData.get('name') ?? ''),
    sortCode: String(formData.get('sortCode') ?? ''),
    routingNumber: String(formData.get('routingNumber') ?? ''),
  }
  const parsed = updateBranchSchema.safeParse({
    id: formData.get('id'),
    bankId: formData.get('bankId'),
    ...values,
  })
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors, values }

  await db
    .update(branches)
    .set({
      name: parsed.data.name,
      sortCode: parsed.data.sortCode ?? null,
      routingNumber: parsed.data.routingNumber ?? null,
      updatedAt: new Date(),
    })
    .where(eq(branches.id, parsed.data.id))
  revalidateBank(parsed.data.bankId)
  return { ok: true }
}

export async function deleteBranch(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = formData.get('id')
  const bankId = formData.get('bankId')
  if (typeof id !== 'string') return { errors: { id: ['Missing id'] } }

  await db.delete(branches).where(eq(branches.id, id))
  if (typeof bankId === 'string') revalidateBank(bankId)
  return { ok: true }
}

// ── Accounts ─────────────────────────────────────────────────────────────────

export type AccountWithBranch = Account & { branch: Branch | null }

export async function listAccounts(bankId: string): Promise<AccountWithBranch[]> {
  return db.query.accounts.findMany({
    where: eq(accounts.bankId, bankId),
    with: { branch: true },
    orderBy: asc(accounts.name),
  })
}

/** Empty / sentinel branch select value → undefined. */
function normalizeBranchId(value: FormDataEntryValue | null): string {
  return value === 'none' || value === null ? '' : String(value)
}

export async function createAccount(_prev: ActionState, formData: FormData): Promise<ActionState> {
  // branchId keeps its raw select value ('none' or a branch id) so the Select
  // can repopulate; parsing normalizes 'none' → '' separately.
  const values = {
    name: String(formData.get('name') ?? ''),
    type: String(formData.get('type') ?? ''),
    currency: String(formData.get('currency') ?? ''),
    branchId: String(formData.get('branchId') ?? 'none'),
  }
  const parsed = createAccountSchema.safeParse({
    bankId: formData.get('bankId'),
    branchId: normalizeBranchId(formData.get('branchId')),
    name: values.name,
    type: values.type,
    currency: values.currency,
  })
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors, values }
  if (!(await bankExists(parsed.data.bankId)))
    return { errors: { bankId: ['Unknown bank'] }, values }

  await db.insert(accounts).values({
    bankId: parsed.data.bankId,
    branchId: parsed.data.branchId ?? null,
    name: parsed.data.name,
    type: parsed.data.type,
    currency: parsed.data.currency,
  })
  revalidateAccountViews(parsed.data.bankId)
  return { ok: true }
}

export async function updateAccount(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = {
    name: String(formData.get('name') ?? ''),
    type: String(formData.get('type') ?? ''),
    currency: String(formData.get('currency') ?? ''),
    branchId: String(formData.get('branchId') ?? 'none'),
  }
  const parsed = updateAccountSchema.safeParse({
    id: formData.get('id'),
    bankId: formData.get('bankId'),
    branchId: normalizeBranchId(formData.get('branchId')),
    name: values.name,
    type: values.type,
    currency: values.currency,
  })
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors, values }

  await db
    .update(accounts)
    .set({
      branchId: parsed.data.branchId ?? null,
      name: parsed.data.name,
      type: parsed.data.type,
      currency: parsed.data.currency,
      updatedAt: new Date(),
    })
    .where(eq(accounts.id, parsed.data.id))
  revalidateAccountViews(parsed.data.bankId)
  return { ok: true }
}

export async function deleteAccount(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = formData.get('id')
  const bankId = formData.get('bankId')
  if (typeof id !== 'string') return { errors: { id: ['Missing id'] } }

  await db.delete(accounts).where(eq(accounts.id, id))
  if (typeof bankId === 'string') revalidateAccountViews(bankId)
  return { ok: true }
}
