'use client'

import { Input, Label } from '@repo/ui'
import { type ChangeEvent, useEffect, useId, useRef, useState } from 'react'
import {
  caretAfterDigits,
  digitsBefore,
  formatPlaceholder,
  formatTypedAmount,
  fromCanonicalAmount,
  toCanonicalAmount,
} from '@/lib/number-format'

/**
 * An amount field that groups digits as they are typed.
 *
 * Two things make this more than a formatter:
 *
 * - **The value submitted is canonical.** The box shows `450,000.50`, the form
 *   posts `450000.50`, so the server schemas never learn about locales.
 * - **The caret is restored by digit count, not character offset.** Inserting a
 *   separator shifts every character after it, so restoring the offset would
 *   walk the caret sideways with each keystroke.
 */
export function MoneyInput({
  label,
  hideLabel = false,
  name,
  defaultValue = '',
  value,
  placeholder,
  locale,
  error,
  onCanonicalChange,
  id,
}: {
  label?: string
  /** Keep the label for screen readers but do not draw it, e.g. in a table row. */
  hideLabel?: boolean
  name?: string
  /** Canonical, e.g. `450000.50`. Uncontrolled: only the initial value. */
  defaultValue?: string
  /**
   * Canonical, for a field whose value is derived from elsewhere. The deposit,
   * deposit percentage and loan amount each follow the other two, so the two the
   * user is not editing have to update.
   */
  value?: string
  /** A number, formatted for the locale. */
  placeholder?: number
  locale: string
  error?: string[]
  /** Called with the canonical value, for panels that recalculate live. */
  onCanonicalChange?: (value: string) => void
  id?: string
}) {
  const generatedId = useId()
  const fieldId = id ?? name ?? generatedId
  const inputRef = useRef<HTMLInputElement>(null)
  const [display, setDisplay] = useState(() => fromCanonicalAmount(value ?? defaultValue, locale))

  // Follow an externally derived value, but never while this is the field being
  // typed into: reformatting under the user's cursor is how these inputs start
  // fighting back.
  useEffect(() => {
    if (value === undefined) return
    if (inputRef.current === document.activeElement) return
    setDisplay(fromCanonicalAmount(value, locale))
  }, [value, locale])

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.target
    const caret = input.selectionStart ?? input.value.length
    const digits = digitsBefore(input.value, caret)

    const formatted = formatTypedAmount(input.value, locale)
    setDisplay(formatted)
    onCanonicalChange?.(toCanonicalAmount(formatted, locale))

    // The DOM value is set again after React paints, so the caret can be placed
    // against the string the user will actually see.
    requestAnimationFrame(() => {
      const element = inputRef.current
      if (!element) return
      const position = caretAfterDigits(formatted, digits)
      element.setSelectionRange(position, position)
    })
  }

  return (
    <div className="grid gap-1.5">
      {label && !hideLabel ? <Label htmlFor={fieldId}>{label}</Label> : null}
      <Input
        id={fieldId}
        ref={inputRef}
        inputMode="decimal"
        value={display}
        onChange={handleChange}
        placeholder={placeholder === undefined ? undefined : formatPlaceholder(placeholder, locale)}
        aria-invalid={error ? true : undefined}
        aria-label={hideLabel ? label : label ? undefined : name}
      />
      {/* What the form actually posts. */}
      {name ? <input type="hidden" name={name} value={toCanonicalAmount(display, locale)} /> : null}
      {error?.[0] ? <p className="text-destructive text-xs">{error[0]}</p> : null}
    </div>
  )
}
