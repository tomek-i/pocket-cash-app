import { HelpTip, Input, Label } from '@repo/ui'
import type { ReactNode } from 'react'

/** Labelled text input with an inline validation error. Shared by the finance dialogs. */
export function Field({
  label,
  name,
  defaultValue,
  placeholder,
  error,
  help,
}: {
  label: string
  name: string
  defaultValue?: string
  placeholder?: string
  error?: string[]
  /** Explains what the field means, behind a "?" beside the label. */
  help?: ReactNode
}) {
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center gap-1.5">
        <Label htmlFor={name}>{label}</Label>
        {help ? <HelpTip label={`What is ${label.toLowerCase()}?`}>{help}</HelpTip> : null}
      </div>
      <Input
        id={name}
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
      />
      {error?.[0] ? <p className="text-destructive text-xs">{error[0]}</p> : null}
    </div>
  )
}
