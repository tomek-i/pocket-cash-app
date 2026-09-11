'use server'

import {
  and,
  asc,
  costTypes,
  db,
  eq,
  isNull,
  type Jurisdiction,
  jurisdictions,
  type Property,
  type PropertyLoan,
  properties,
  propertyCosts,
  propertyLoans,
  TRANSFER_TAX_GROUP,
} from '@repo/database'
import { createPropertySchema, propertyIdSchema, updatePropertySchema } from '@repo/validation'
import { revalidatePath } from 'next/cache'
import type { ActionState } from '@/lib/action-state'

export type PropertyWithLoans = Property & { loans: PropertyLoan[] }

/** Every property, newest activity first, with the loans held against it. */
export async function listProperties(): Promise<PropertyWithLoans[]> {
  return db.query.properties.findMany({
    with: { loans: true },
    orderBy: [asc(properties.sortOrder), asc(properties.name)],
  })
}

/** The configured jurisdictions, for the picker. Never a hard-coded country list. */
export async function listJurisdictions(): Promise<Jurisdiction[]> {
  return db
    .select()
    .from(jurisdictions)
    .where(eq(jurisdictions.enabled, true))
    .orderBy(asc(jurisdictions.name))
}

/** The form fields, as strings, ready to echo back on a validation failure. */
function readValues(formData: FormData): Record<string, string> {
  const fields = [
    'name',
    'address',
    'jurisdictionKey',
    'country',
    'region',
    'currency',
    'type',
    'intendedUse',
    'status',
    'purchasePrice',
    'marketValue',
    'ownershipShare',
    'purchaseDate',
    'notes',
    'loanAmount',
    'interestRate',
    'loanTermYears',
    'offsetBalance',
    'loanType',
  ]
  return Object.fromEntries(fields.map((field) => [field, String(formData.get(field) ?? '')]))
}

/**
 * Country, region and currency follow the chosen jurisdiction.
 *
 * Letting the two disagree is the bug this prevents: a property tagged `AU-NSW`
 * but stored with `country: 'GB'` would resolve NSW rate schedules while
 * displaying British figures. When no jurisdiction is chosen the user's own
 * entries stand.
 */
async function applyJurisdiction(input: {
  jurisdictionKey?: string
  country: string
  region?: string
  currency: string
}): Promise<{
  jurisdictionKey: string | null
  country: string
  region: string | null
  currency: string
}> {
  if (!input.jurisdictionKey) {
    return {
      jurisdictionKey: null,
      country: input.country,
      region: input.region ?? null,
      currency: input.currency,
    }
  }

  const jurisdiction = await db.query.jurisdictions.findFirst({
    where: eq(jurisdictions.key, input.jurisdictionKey),
  })
  if (!jurisdiction) {
    return {
      jurisdictionKey: null,
      country: input.country,
      region: input.region ?? null,
      currency: input.currency,
    }
  }

  return {
    jurisdictionKey: jurisdiction.key,
    country: jurisdiction.country,
    region: jurisdiction.region,
    currency: jurisdiction.currency,
  }
}

/** True when the user filled in anything about a loan. */
function hasLoanInput(parsed: {
  loanAmount?: number
  interestRate?: number
  loanTermYears?: number
  offsetBalance?: number
}): boolean {
  return (
    parsed.loanAmount !== undefined ||
    parsed.interestRate !== undefined ||
    parsed.loanTermYears !== undefined ||
    // An offset with no loan is not much of a loan, but silently dropping a
    // figure the user typed is worse than creating a row they can correct.
    parsed.offsetBalance !== undefined
  )
}

export async function createProperty(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = readValues(formData)
  const parsed = createPropertySchema.safeParse(values)
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors, values }

  const data = parsed.data
  const place = await applyJurisdiction(data)

  await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(properties)
      .values({
        name: data.name,
        address: data.address ?? null,
        ...place,
        type: data.type,
        intendedUse: data.intendedUse,
        status: data.status,
        purchasePrice: data.purchasePrice ?? 0,
        marketValue: data.marketValue ?? null,
        ownershipShare: data.ownershipShare ?? 1,
        purchaseDate: data.purchaseDate ?? null,
        notes: data.notes ?? null,
      })
      .returning({ id: properties.id })

    if (created && hasLoanInput(data)) {
      await tx.insert(propertyLoans).values({
        propertyId: created.id,
        loanAmount: data.loanAmount ?? 0,
        annualRate: data.interestRate ?? 0,
        termYears: data.loanTermYears ?? 30,
        loanType: data.loanType ?? 'principalAndInterest',
        offsetBalance: data.offsetBalance ?? 0,
      })
    }

    // Start the purchase tax switched on.
    //
    // A new property used to open with no costs at all, so the planner's headline
    // "cash required" was the deposit alone: on a $1.1m NSW purchase that is short
    // by roughly $47,000 of transfer duty, presented as a settled figure. Silence
    // is the wrong default for a charge that is not optional in the jurisdiction.
    //
    // Only the transfer tax. Inspections, conveyancing and the rest genuinely vary
    // by purchase, and guessing at those would trade one wrong total for another.
    // It is an ordinary cost row, so it can be disabled or overridden like any
    // other.
    if (created) {
      const [transferTax] = await tx
        .select({ id: costTypes.id })
        .from(costTypes)
        .where(
          and(
            eq(costTypes.rateScheduleGroup, TRANSFER_TAX_GROUP),
            eq(costTypes.enabled, true),
            isNull(costTypes.deletedAt),
          ),
        )
        .limit(1)

      if (transferTax) {
        await tx
          .insert(propertyCosts)
          .values({ propertyId: created.id, costTypeId: transferTax.id })
      }
    }
  })

  revalidatePath('/app/property')
  return { ok: true }
}

export async function updateProperty(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = readValues(formData)
  const parsed = updatePropertySchema.safeParse({ id: formData.get('id'), ...values })
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors, values }

  const data = parsed.data
  const place = await applyJurisdiction(data)

  await db.transaction(async (tx) => {
    await tx
      .update(properties)
      .set({
        name: data.name,
        address: data.address ?? null,
        ...place,
        type: data.type,
        intendedUse: data.intendedUse,
        status: data.status,
        purchasePrice: data.purchasePrice ?? 0,
        marketValue: data.marketValue ?? null,
        ownershipShare: data.ownershipShare ?? 1,
        purchaseDate: data.purchaseDate ?? null,
        notes: data.notes ?? null,
        updatedAt: new Date(),
      })
      .where(eq(properties.id, data.id))

    // The dialog edits a single loan. Update the first one if it exists, add one
    // if the user has just filled the fields in, and leave extra loans alone:
    // the planner is where multiple loans are managed.
    const existing = await tx.query.propertyLoans.findFirst({
      where: eq(propertyLoans.propertyId, data.id),
    })

    if (existing) {
      await tx
        .update(propertyLoans)
        .set({
          loanAmount: data.loanAmount ?? 0,
          annualRate: data.interestRate ?? 0,
          termYears: data.loanTermYears ?? existing.termYears,
          loanType: data.loanType ?? existing.loanType,
          // Cleared means zero, the same reading the loan amount above takes.
          offsetBalance: data.offsetBalance ?? 0,
          updatedAt: new Date(),
        })
        .where(eq(propertyLoans.id, existing.id))
    } else if (hasLoanInput(data)) {
      await tx.insert(propertyLoans).values({
        propertyId: data.id,
        loanAmount: data.loanAmount ?? 0,
        annualRate: data.interestRate ?? 0,
        termYears: data.loanTermYears ?? 30,
        loanType: data.loanType ?? 'principalAndInterest',
        offsetBalance: data.offsetBalance ?? 0,
      })
    }
  })

  revalidatePath('/app/property')
  return { ok: true }
}

export async function deleteProperty(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = propertyIdSchema.safeParse({ id: formData.get('id') })
  if (!parsed.success) return { errors: { id: ['Missing id'] } }

  await db.delete(properties).where(eq(properties.id, parsed.data.id))
  revalidatePath('/app/property')
  return { ok: true }
}
