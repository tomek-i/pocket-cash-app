'use client'

import type { ReactNode } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'

/**
 * A select built from a list of options.
 *
 * Base UI renders the closed trigger from the raw value unless the root is given
 * an `items` map, so every call site that passed labels as `SelectItem` children
 * alone showed `monthly` instead of `Monthly`. The labels were right the moment
 * the menu opened, which is what made it easy to miss.
 *
 * Deriving `items` and the children from one array removes the chance to get it
 * wrong: a label cannot be given to one and withheld from the other. `label` is a
 * `ReactNode`, so an option that carries an icon or a colour swatch carries it in
 * the trigger too.
 *
 * The vendored primitives in `./ui/select` stay untouched; this composes them.
 */

export interface SelectOption {
  value: string
  /** Shown in the menu and in the closed trigger. */
  label: ReactNode
  disabled?: boolean
}

export function OptionSelect({
  options,
  name,
  id,
  value,
  defaultValue,
  onValueChange,
  disabled,
  className,
  contentClassName,
  size,
  ariaLabel,
  placeholder,
}: {
  options: SelectOption[]
  name?: string
  id?: string
  /** Controlled value. Leave unset and use `defaultValue` for form usage. */
  value?: string
  defaultValue?: string
  /**
   * Base UI hands back `string | null`, null being a cleared selection. Every
   * call site here has a sentinel option instead ("all", "none"), so null is
   * dropped rather than pushed onto callers as a case they do not have.
   */
  onValueChange?: (value: string) => void
  disabled?: boolean
  /** Applied to the trigger, which is what call sites size. */
  className?: string
  contentClassName?: string
  size?: 'sm' | 'default'
  ariaLabel?: string
  /** Shown when nothing is selected yet. */
  placeholder?: string
}) {
  const items: Record<string, ReactNode> = {}
  for (const option of options) items[option.value] = option.label

  return (
    <Select
      items={items}
      name={name}
      value={value}
      defaultValue={defaultValue}
      onValueChange={(next) => {
        if (next !== null) onValueChange?.(next)
      }}
      disabled={disabled}
    >
      <SelectTrigger id={id} className={className} size={size} aria-label={ariaLabel}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className={contentClassName}>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
