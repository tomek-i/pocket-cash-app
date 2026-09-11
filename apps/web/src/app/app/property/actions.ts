'use server'

import {
  and,
  asc,
  costTypes,
  db,
  eq,
  getAppSettings,
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
import {
  createPropertySchema,
  promotePlanSchema,
  propertyIdSchema,
  updatePropertySchema,
} from '@repo/validation'
import { revalidatePath } from 'next/cache'
import type { ActionState } from '@/lib/action-state'

export type PropertyWithLoans = Property & { loans: PropertyLoan[] }

/** The transaction handle, typed the way `_lib/seed.ts` does it. */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

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
}): boolean {
  return (
    parsed.loanAmount !== undefined ||
    parsed.interestRate !== undefined ||
    parsed.loanTermYears !== undefined
  )
}

/**
 * Start the purchase tax switched on.
 *
 * A new property used to open with no costs at all, so the planner's headline
 * "cash required" was the deposit alone: on a $1.1m NSW purchase that is short by
 * roughly $47,000 of transfer duty, presented as a settled figure. Silence is the
 * wrong default for a charge that is not optional in the jurisdiction.
 *
 * Only the transfer tax. Inspections, conveyancing and the rest genuinely vary by
 * purchase, and guessing at those would trade one wrong total for another. It is
 * an ordinary cost row, so it can be disabled or overridden like any other.
 */
async function seedTransferTax(tx: Tx, propertyId: string): Promise<void> {
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
    await tx.insert(propertyCosts).values({ propertyId, costTypeId: transferTax.id })
  }
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
      })
    }

    if (created) await seedTransferTax(tx, created.id)
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
      })
    }
  })

  revalidatePath('/app/property')
  return { ok: true }
}

/**
 * Start a plan: the planner with no particular house behind it.
 *
 * Sometimes you want to push prices and deposits around to see where you would
 * stand, before any specific property exists. A plan is a property in `draft`,
 * not a separate kind of object, because everything the planner persists (the
 * loan, the costs, the scenarios) already hangs off a property row and would
 * otherwise need a parallel structure of its own.
 *
 * No dialog: a plan you have to fill in a form to start is a plan you do not
 * start. Name and address come later, if it ever becomes a real purchase.
 */
export async function startPlan(): Promise<string> {
  const [jurisdiction] = await db
    .select()
    .from(jurisdictions)
    .where(eq(jurisdictions.enabled, true))
    .orderBy(asc(jurisdictions.name))
    .limit(1)

  const settings = await getAppSettings()

  const id = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(properties)
      .values({
        name: 'Untitled plan',
        status: 'draft',
        jurisdictionKey: jurisdiction?.key ?? null,
        country: jurisdiction?.country ?? 'AU',
        region: jurisdiction?.region ?? null,
        currency: jurisdiction?.currency ?? settings.defaultCurrency ?? 'AUD',
      })
      .returning({ id: properties.id })

    if (!created) throw new Error('Could not start a plan')
    await seedTransferTax(tx, created.id)
    return created.id
  })

  revalidatePath('/app/property')
  return id
}

/**
 * Promote a plan to a property you are actually pursuing.
 *
 * Only the status moves. Everything modelled on the plan (the loan, the costs,
 * the scenarios) is already attached to this row, so nothing is copied and
 * nothing is lost.
 */
export async function promotePlan(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = { id: String(formData.get('id') ?? ''), name: String(formData.get('name') ?? '') }
  const parsed = promotePlanSchema.safeParse(values)
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors, values }

  await db
    .update(properties)
    .set({ name: parsed.data.name, status: 'planned', updatedAt: new Date() })
    .where(eq(properties.id, parsed.data.id))

  revalidatePath('/app/property', 'layout')
  return { ok: true }
}

export async function deleteProperty(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = propertyIdSchema.safeParse({ id: formData.get('id') })
  if (!parsed.success) return { errors: { id: ['Missing id'] } }

  await db.delete(properties).where(eq(properties.id, parsed.data.id))
  revalidatePath('/app/property')
  return { ok: true }
}
