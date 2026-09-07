import { Input, Label } from '@repo/ui'

/**
 * A date field backed by the platform's own picker.
 *
 * `type="date"` displays in the machine's format while its value stays
 * `YYYY-MM-DD`, which is exactly what the Zod schemas already expect. So this
 * is a change to what the user sees and nothing else: no parsing, no conversion,
 * no new format for the server to learn.
 */
export function DateField({
  label,
  name,
  defaultValue,
  error,
  min,
  max,
}: {
  label: string
  name: string
  defaultValue?: string
  error?: string[]
  min?: string
  max?: string
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type="date"
        defaultValue={defaultValue}
        min={min}
        max={max}
        aria-invalid={error ? true : undefined}
      />
      {error?.[0] ? <p className="text-destructive text-xs">{error[0]}</p> : null}
    </div>
  )
}
