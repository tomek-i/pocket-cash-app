'use server'

import {
  and,
  db,
  eq,
  type Jurisdiction,
  jurisdictions,
  lte,
  ne,
  type Property,
  type PropertyLoan,
  properties,
  propertyLoans,
  type RateScheduleRow,
  rateSchedules,
  TRANSFER_TAX_GROUP,
} from '@repo/database'
import { GENERIC_TRANSFER_TAX_LABEL } from '@repo/property/defaults'
import { plannerDetailsSchema, plannerFinancingSchema } from '@repo/validation'
import { revalidatePath } from 'next/cache'
import type { ActionState } from '@/lib/action-state'

export type PlannerProperty = Property & { loans: PropertyLoan[] }

export interface PlannerData {
  property: PlannerProperty
  /** Every other property, for the portfolio impact panel. */
  others: PlannerProperty[]
  jurisdiction: Jurisdiction | null
  jurisdictions: Jurisdiction[]
  /** What this jurisdiction calls its purchase tax. Never hard-coded. */
  transferTaxLabel: string
  /** The schedule that applies on the purchase date, for the costs section. */
  transferTaxSchedule: RateScheduleRow | null
}

/** Everything the planner page renders, in one round trip. */
export async function getPlannerData(propertyId: string): Promise<PlannerData | null> {
  const property = await db.query.properties.findFirst({
    where: eq(properties.id, propertyId),
    with: { loans: true },
  })
  if (!property) return null

  // What else the user holds, so the planner can say where this purchase leaves
  // the portfolio rather than only what it costs.
  const others = await db.query.properties.findMany({
    where: ne(properties.id, propertyId),
    with: { loans: true },
  })

  const allJurisdictions = await db
    .select()
    .from(jurisdictions)
    .where(eq(jurisdictions.enabled, true))

  const jurisdiction =
    allJurisdictions.find((entry) => entry.key === property.jurisdictionKey) ?? null

  return {
    property,
    others,
    jurisdiction,
    jurisdictions: allJurisdictions,
    transferTaxLabel: jurisdiction?.transferTaxLabel ?? GENERIC_TRANSFER_TAX_LABEL,
    transferTaxSchedule: jurisdiction
      ? await findTransferTaxSchedule(jurisdiction.key, property.purchaseDate)
      : null,
  }
}

/**
 * The transfer tax schedule in force for a jurisdiction on a date.
 *
 * Resolved by jurisdiction, charge group and date rather than by a fixed id, so
 * adding next year's rates does not require editing anything else. A purchase
 * with no date yet uses today, which is what someone modelling a purchase now
 * would expect.
 */
async function findTransferTaxSchedule(
  jurisdictionKey: string,
  purchaseDate: string | null,
): Promise<RateScheduleRow | null> {
  const on = purchaseDate ?? new Date().toISOString().slice(0, 10)

  const candidates = await db
    .select()
    .from(rateSchedules)
    .where(
      and(
        eq(rateSchedules.jurisdictionKey, jurisdictionKey),
        eq(rateSchedules.groupKey, TRANSFER_TAX_GROUP),
        eq(rateSchedules.enabled, true),
        lte(rateSchedules.effectiveFrom, on),
      ),
    )

  // `effectiveTo` is inclusive and nullable, which SQL cannot express as neatly
  // as the filter above, so the end of the range is checked here.
  const effective = candidates.filter(
    (schedule) => schedule.effectiveTo === null || schedule.effectiveTo >= on,
  )

  return (
    effective.sort((a, b) =>
      a.effectiveFrom === b.effectiveFrom
        ? b.version - a.version
        : a.effectiveFrom < b.effectiveFrom
          ? 1
          : -1,
    )[0] ?? null
  )
}

function readValues(formData: FormData, fields: string[]): Record<string, string> {
  return Object.fromEntries(fields.map((field) => [field, String(formData.get(field) ?? '')]))
}

const DETAIL_FIELDS = [
  'name',
  'address',
  'jurisdictionKey',
  'country',
  'region',
  'currency',
  'type',
  'intendedUse',
  'status',
  'purchaseDate',
]

/** Property details. The jurisdiction supplies country, region and currency. */
export async function savePlannerDetails(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const values = readValues(formData, DETAIL_FIELDS)
  const parsed = plannerDetailsSchema.safeParse({ id: formData.get('id'), ...values })
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors, values }

  const data = parsed.data
  const jurisdiction = data.jurisdictionKey
    ? await db.query.jurisdictions.findFirst({ where: eq(jurisdictions.key, data.jurisdictionKey) })
    : undefined

  await db
    .update(properties)
    .set({
      name: data.name,
      address: data.address ?? null,
      jurisdictionKey: jurisdiction?.key ?? null,
      country: jurisdiction?.country ?? data.country,
      region: jurisdiction ? jurisdiction.region : (data.region ?? null),
      currency: jurisdiction?.currency ?? data.currency,
      type: data.type,
      intendedUse: data.intendedUse,
      status: data.status,
      purchaseDate: data.purchaseDate ?? null,
      updatedAt: new Date(),
    })
    .where(eq(properties.id, data.id))

  revalidatePath(`/app/property/${data.id}/planner`)
  revalidatePath('/app/property')
  return { ok: true }
}

const FINANCING_FIELDS = [
  'source',
  'purchasePrice',
  'marketValue',
  'deposit',
  'depositPercentage',
  'loanAmount',
  'interestRate',
  'loanTermYears',
  'loanType',
  'offsetBalance',
  'otherFinancingCosts',
]

/**
 * Financing. Only the figure named by `source` is trusted; the deposit and loan
 * are recomputed from it so the stored pair can never contradict each other.
 */
export async function savePlannerFinancing(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const values = readValues(formData, FINANCING_FIELDS)
  const parsed = plannerFinancingSchema.safeParse({ id: formData.get('id'), ...values })
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors, values }

  const data = parsed.data
  const purchasePrice = data.purchasePrice ?? 0

  const loanAmount =
    data.source === 'loanAmount'
      ? (data.loanAmount ?? 0)
      : data.source === 'depositPercentage'
        ? Math.max(0, purchasePrice - Math.round(purchasePrice * (data.depositPercentage ?? 0)))
        : Math.max(0, purchasePrice - (data.deposit ?? 0))

  await db.transaction(async (tx) => {
    await tx
      .update(properties)
      .set({
        purchasePrice,
        marketValue: data.marketValue ?? null,
        updatedAt: new Date(),
      })
      .where(eq(properties.id, data.id))

    const existing = await tx.query.propertyLoans.findFirst({
      where: eq(propertyLoans.propertyId, data.id),
    })

    const loanValues = {
      loanAmount,
      annualRate: data.interestRate ?? 0,
      termYears: data.loanTermYears ?? existing?.termYears ?? 30,
      loanType: data.loanType,
      offsetBalance: data.offsetBalance ?? 0,
      otherFinancingCosts: data.otherFinancingCosts ?? 0,
    }

    if (existing) {
      await tx
        .update(propertyLoans)
        .set({ ...loanValues, updatedAt: new Date() })
        .where(eq(propertyLoans.id, existing.id))
    } else {
      await tx.insert(propertyLoans).values({ propertyId: data.id, ...loanValues })
    }
  })

  revalidatePath(`/app/property/${data.id}/planner`)
  revalidatePath('/app/property')
  return { ok: true }
}
