'use server'

import { type Account, accounts, asc, type Bank, type Branch, branches, db } from '@repo/database'

export type AccountWithBankBranch = Account & { bank: Bank; branch: Branch | null }

/** Every account, with its bank and (optional) branch. */
export async function listAllAccounts(): Promise<AccountWithBankBranch[]> {
  return db.query.accounts.findMany({
    with: { bank: true, branch: true },
    orderBy: asc(accounts.name),
  })
}

/** Every branch. The account dialog filters these by bank client-side. */
export async function listAllBranches(): Promise<Branch[]> {
  return db.select().from(branches).orderBy(asc(branches.name))
}
