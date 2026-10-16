'use client'

import { BUDGET_PRESETS, type BudgetPresetId } from '@repo/budget'
import { cn } from '@repo/ui'
import { useTransition } from 'react'
import { applyBudgetPreset } from '../actions'

/**
 * The presets as a row of choices. The selected one is derived from the split,
 * so dialling any bucket moves the selection to Custom by itself.
 */
export function PresetPicker({ current }: { current: BudgetPresetId | 'custom' | null }) {
  const [pending, startTransition] = useTransition()
  const selected = BUDGET_PRESETS.find((preset) => preset.id === current)

  return (
    <div className="grid gap-2">
      <fieldset className="flex flex-wrap gap-2">
        <legend className="sr-only">Preset</legend>
        {BUDGET_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            aria-pressed={preset.id === current}
            disabled={pending}
            onClick={() => startTransition(() => applyBudgetPreset(preset.id))}
            className={cn(
              'rounded-lg border px-3 py-1.5 font-medium text-sm transition-colors disabled:opacity-60',
              preset.id === current
                ? 'border-primary bg-primary text-primary-foreground'
                : 'bg-background hover:bg-muted',
            )}
          >
            {preset.name}
          </button>
        ))}
        {/* Not a button: Custom is what the split becomes once any dial moves. */}
        <span
          className={cn(
            'rounded-lg border border-dashed px-3 py-1.5 font-medium text-sm',
            current === 'custom'
              ? 'border-primary text-foreground'
              : 'text-muted-foreground opacity-70',
          )}
        >
          Custom
          {current === 'custom' ? <span className="sr-only"> (current)</span> : null}
        </span>
      </fieldset>
      <p className="text-muted-foreground text-xs">
        {selected
          ? `${selected.description} ${selected.basedOn}`
          : current === 'custom'
            ? 'Your own split. Pick a preset to start again from one.'
            : 'Pick a preset to start. You can change every number afterwards.'}
      </p>
    </div>
  )
}
