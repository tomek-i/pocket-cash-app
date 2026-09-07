/**
 * The default cost categories. Data, not an enum: users can add their own, so
 * nothing in the engine may switch on these values.
 */

export interface CostCategory {
  id: string
  name: string
  /** Ordering hint for the settings list and the cost breakdown. */
  order: number
}

export const DEFAULT_COST_CATEGORIES: CostCategory[] = [
  { id: 'government', name: 'Government / Tax', order: 10 },
  { id: 'legal', name: 'Legal', order: 20 },
  { id: 'inspection', name: 'Inspection', order: 30 },
  { id: 'financing', name: 'Financing', order: 40 },
  { id: 'registration', name: 'Registration', order: 50 },
  { id: 'insurance', name: 'Insurance', order: 60 },
  { id: 'moving', name: 'Moving', order: 70 },
  { id: 'renovation', name: 'Renovation', order: 80 },
  { id: 'maintenance', name: 'Maintenance', order: 90 },
  { id: 'other', name: 'Other', order: 100 },
]
