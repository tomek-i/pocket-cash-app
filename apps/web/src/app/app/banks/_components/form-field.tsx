import { Input, Label } from '@repo/ui'

/** Labelled text input with an inline validation error. Shared by the finance dialogs. */
export function Field({
  label,
  name,
  defaultValue,
  placeholder,
  error,
}: {
  label: string
  name: string
  defaultValue?: string
  placeholder?: string
  error?: string[]
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={name}>{label}</Label>
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
