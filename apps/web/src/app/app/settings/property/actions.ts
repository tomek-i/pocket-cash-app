'use server'

import {
  asc,
  type CostType,
  costTypes,
  count,
  db,
  eq,
  getAppSettings,
  type Jurisdiction,
  jurisdictions,
  type PropertySettings,
  propertyCosts,
  propertyRecurringCosts,
  saveAppSettings,
} from '@repo/database'
import {
  DEFAULT_CALCULATION_SETTINGS,
  DEFAULT_RECURRING_COST_TYPES,
  DEFAULT_UPFRONT_COST_TYPES,
} from '@repo/property/defaults'
import {
  costTypeIdSchema,
  createCostTypeSchema,
  createJurisdictionSchema,
  jurisdictionIdSchema,
  propertyCalculationSettingsSchema,
  toggleCostTypeSchema,
  updateCostTypeSchema,
  updateJurisdictionSchema,
} from '@repo/validation'
import { revalidatePath } from 'next/cache'
import { type ActionState, isUniqueViolation } from '@/lib/action-state'

/**
 * Settings for the property feature.
 *
 * On the system versus user question: seeding is insert-only (see
 * `seedPropertyDefaults`), so a seeded row is the user's own copy and editing it
 * is safe. What is never mutated is the shipped definition in
 * `@repo/property/defaults`, which is why "Restore shipped default" below can
 * always put a system row back.
 */

function revalidate(): void {
  revalidatePath('/app/settings/property')
  revalidatePath('/app/property')
}

// ── Cost types ───────────────────────────────────────────────────────────────

export async function listAllCostTypes(): Promise<CostType[]> {
  return db.select().from(costTypes).orderBy(asc(costTypes.scope), asc(costTypes.name))
}

function readCostTypeValues(formData: FormData): Record<string, string> {
  const fields = [
    'name',
    'defaultValue',
    'category',
    'scope',
    'calculationType',
    'percentage',
    'calculationBase',
    'formula',
    'defaultFrequency',
    'notes',
  ]
  return Object.fromEntries(fields.map((field) => [field, String(formData.get(field) ?? '')]))
}

export async function createCostType(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = readCostTypeValues(formData)
  const parsed = createCostTypeSchema.safeParse(values)
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors, values }

  const data = parsed.data
  await db.insert(costTypes).values({
    // No `key`: keys identify seeded rows, and a user-created type is not one.
    name: data.name,
    category: data.category || 'other',
    scope: data.scope,
    calculationType: data.calculationType,
    defaultValue: data.defaultValue ?? null,
    percentage: data.percentage ?? null,
    calculationBase: data.calculationBase ?? null,
    formula: data.formula ?? null,
    defaultFrequency: data.defaultFrequency ?? null,
    notes: data.notes ?? null,
    isSystem: false,
  })

  revalidate()
  return { ok: true }
}

export async function updateCostType(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = readCostTypeValues(formData)
  const parsed = updateCostTypeSchema.safeParse({ id: formData.get('id'), ...values })
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors, values }

  const data = parsed.data
  await db
    .update(costTypes)
    .set({
      name: data.name,
      category: data.category || 'other',
      scope: data.scope,
      calculationType: data.calculationType,
      defaultValue: data.defaultValue ?? null,
      percentage: data.percentage ?? null,
      calculationBase: data.calculationBase ?? null,
      formula: data.formula ?? null,
      defaultFrequency: data.defaultFrequency ?? null,
      notes: data.notes ?? null,
      updatedAt: new Date(),
    })
    .where(eq(costTypes.id, data.id))

  revalidate()
  return { ok: true }
}

export async function toggleCostType(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = toggleCostTypeSchema.safeParse({
    id: formData.get('id'),
    enabled: formData.get('enabled'),
  })
  if (!parsed.success) return { errors: { id: ['Missing id'] } }

  await db
    .update(costTypes)
    .set({ enabled: parsed.data.enabled === 'true', updatedAt: new Date() })
    .where(eq(costTypes.id, parsed.data.id))

  revalidate()
  return { ok: true }
}

/** How many properties use a cost type, across upfront and ongoing costs. */
async function countCostTypeUses(costTypeId: string): Promise<number> {
  const [upfront] = await db
    .select({ n: count() })
    .from(propertyCosts)
    .where(eq(propertyCosts.costTypeId, costTypeId))
  const [recurring] = await db
    .select({ n: count() })
    .from(propertyRecurringCosts)
    .where(eq(propertyRecurringCosts.costTypeId, costTypeId))
  return (upfront?.n ?? 0) + (recurring?.n ?? 0)
}

/**
 * Delete a cost type, or soft delete it when a property already uses it.
 *
 * The foreign key on `property_costs` is `restrict`, so a hard delete of a type
 * in use would be refused by the database anyway. Checking first turns that into
 * the behaviour the user wants: the type disappears from the Add Cost list while
 * the properties that reference it keep working.
 */
export async function deleteCostType(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = costTypeIdSchema.safeParse({ id: formData.get('id') })
  if (!parsed.success) return { errors: { id: ['Missing id'] } }

  const { id } = parsed.data
  const type = await db.query.costTypes.findFirst({ where: eq(costTypes.id, id) })
  if (!type) return { ok: true }

  // A system type is never removed outright, so "Restore shipped default" can
  // always bring it back.
  if (type.isSystem || (await countCostTypeUses(id)) > 0) {
    await db
      .update(costTypes)
      .set({ deletedAt: new Date(), enabled: false, updatedAt: new Date() })
      .where(eq(costTypes.id, id))
  } else {
    await db.delete(costTypes).where(eq(costTypes.id, id))
  }

  revalidate()
  return { ok: true }
}

/**
 * Put a seeded cost type back to the definition Pocket Cash ships.
 *
 * This is what makes editing a system row safe: the shipped definition lives in
 * code and is never written to, so it is always available to restore from.
 */
export async function restoreCostTypeDefault(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = costTypeIdSchema.safeParse({ id: formData.get('id') })
  if (!parsed.success) return { errors: { id: ['Missing id'] } }

  const type = await db.query.costTypes.findFirst({ where: eq(costTypes.id, parsed.data.id) })
  if (!type?.key) return { errors: { id: ['This cost was not shipped with the app'] } }

  const upfront = DEFAULT_UPFRONT_COST_TYPES.find((entry) => entry.id === type.key)
  const recurring = DEFAULT_RECURRING_COST_TYPES.find((entry) => entry.id === type.key)
  const shipped = upfront ?? recurring
  if (!shipped) return { errors: { id: ['No shipped default for this cost'] } }

  await db
    .update(costTypes)
    .set({
      name: shipped.name,
      category: shipped.category,
      calculationType: shipped.calculationType,
      defaultValue: shipped.defaultValue ?? null,
      percentage: shipped.percentage ?? null,
      calculationBase: shipped.calculationBase ?? null,
      formula: shipped.formula ?? null,
      defaultFrequency: recurring?.defaultFrequency ?? null,
      notes: shipped.notes ?? null,
      enabled: shipped.enabled,
      deletedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(costTypes.id, type.id))

  revalidate()
  return { ok: true }
}

// ── Jurisdictions ────────────────────────────────────────────────────────────

export async function listAllJurisdictions(): Promise<Jurisdiction[]> {
  return db.select().from(jurisdictions).orderBy(asc(jurisdictions.name))
}

function readJurisdictionValues(formData: FormData): Record<string, string> {
  const fields = ['key', 'name', 'country', 'region', 'currency', 'transferTaxLabel']
  return Object.fromEntries(fields.map((field) => [field, String(formData.get(field) ?? '')]))
}

export async function createJurisdiction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const values = readJurisdictionValues(formData)
  const parsed = createJurisdictionSchema.safeParse(values)
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors, values }

  const data = parsed.data
  try {
    await db.insert(jurisdictions).values({
      key: data.key,
      name: data.name,
      country: data.country,
      region: data.region ?? null,
      currency: data.currency,
      transferTaxLabel: data.transferTaxLabel,
      isSystem: false,
    })
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { errors: { key: ['A jurisdiction with this key already exists'] }, values }
    }
    throw error
  }

  revalidate()
  return { ok: true }
}

export async function updateJurisdiction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const values = readJurisdictionValues(formData)
  const parsed = updateJurisdictionSchema.safeParse({ id: formData.get('id'), ...values })
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors, values }

  const data = parsed.data
  try {
    await db
      .update(jurisdictions)
      .set({
        key: data.key,
        name: data.name,
        country: data.country,
        region: data.region ?? null,
        currency: data.currency,
        transferTaxLabel: data.transferTaxLabel,
        updatedAt: new Date(),
      })
      .where(eq(jurisdictions.id, data.id))
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { errors: { key: ['A jurisdiction with this key already exists'] }, values }
    }
    throw error
  }

  revalidate()
  return { ok: true }
}

/**
 * Remove a jurisdiction.
 *
 * Rate schedules cascade from the jurisdiction key, so deleting one takes its
 * schedules with it. Properties reference it with `set null`, so they survive
 * but lose their rules, which is why the confirmation says so.
 */
export async function deleteJurisdiction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = jurisdictionIdSchema.safeParse({ id: formData.get('id') })
  if (!parsed.success) return { errors: { id: ['Missing id'] } }

  await db.delete(jurisdictions).where(eq(jurisdictions.id, parsed.data.id))
  revalidate()
  return { ok: true }
}

// ── Calculation defaults ─────────────────────────────────────────────────────

/** The stored defaults, filled in from the shipped ones where unset. */
export async function getPropertySettings(): Promise<Required<PropertySettings>> {
  const settings = await getAppSettings()
  const stored = settings.property ?? {}
  return {
    defaultLoanTermYears:
      stored.defaultLoanTermYears ?? DEFAULT_CALCULATION_SETTINGS.defaultLoanTermYears,
    defaultInterestRate:
      stored.defaultInterestRate ?? DEFAULT_CALCULATION_SETTINGS.defaultInterestRate,
    defaultDepositPercentage:
      stored.defaultDepositPercentage ?? DEFAULT_CALCULATION_SETTINGS.defaultDepositPercentage,
    defaultVacancyRate:
      stored.defaultVacancyRate ?? DEFAULT_CALCULATION_SETTINGS.defaultVacancyRate,
    defaultManagementRate:
      stored.defaultManagementRate ?? DEFAULT_CALCULATION_SETTINGS.defaultManagementRate,
    sensitivityRates: stored.sensitivityRates ?? DEFAULT_CALCULATION_SETTINGS.sensitivityRates,
    maxPortfolioLvr: stored.maxPortfolioLvr ?? DEFAULT_CALCULATION_SETTINGS.maxPortfolioLvr,
  }
}

export async function savePropertySettings(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const values = {
    defaultLoanTermYears: String(formData.get('defaultLoanTermYears') ?? ''),
    defaultInterestRate: String(formData.get('defaultInterestRate') ?? ''),
    defaultDepositPercentage: String(formData.get('defaultDepositPercentage') ?? ''),
    defaultVacancyRate: String(formData.get('defaultVacancyRate') ?? ''),
    defaultManagementRate: String(formData.get('defaultManagementRate') ?? ''),
    sensitivityRates: String(formData.get('sensitivityRates') ?? ''),
    maxPortfolioLvr: String(formData.get('maxPortfolioLvr') ?? ''),
  }
  const parsed = propertyCalculationSettingsSchema.safeParse(values)
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors, values }

  const settings = await getAppSettings()
  await saveAppSettings({
    ...settings,
    property: { ...(settings.property ?? {}), ...parsed.data },
  })

  revalidate()
  return { ok: true }
}
