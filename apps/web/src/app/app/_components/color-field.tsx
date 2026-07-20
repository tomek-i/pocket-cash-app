'use client'

import { Input, Label } from '@repo/ui'
import { useState } from 'react'

const HEX = /^#[0-9a-fA-F]{6}$/

/**
 * Optional colour field: a live-preview swatch that doubles as the native colour
 * picker, kept in sync with an editable hex input (which is what submits). Empty
 * is a valid state (no colour) — the swatch shows a neutral placeholder.
 */
export function ColorField({
  name,
  label,
  defaultValue = '',
  placeholder = '#22c55e',
  error,
}: {
  name: string
  label: string
  defaultValue?: string
  placeholder?: string
  error?: string[]
}) {
  const [value, setValue] = useState(defaultValue)
  const valid = HEX.test(value)

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <div className="flex items-center gap-2">
        {/* Swatch = live preview + native picker (transparent input overlays it). */}
        <label
          className="relative size-9 shrink-0 cursor-pointer overflow-hidden rounded-md border"
          title="Pick a colour"
        >
          {valid ? (
            <span className="block size-full" style={{ backgroundColor: value }} />
          ) : (
            <span className="flex size-full items-center justify-center bg-muted text-[10px] text-muted-foreground">
              —
            </span>
          )}
          <input
            type="color"
            value={valid ? value : '#6b5fd6'}
            onChange={(e) => setValue(e.target.value)}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
            aria-label={`${label} picker`}
          />
        </label>
        <Input
          id={name}
          name={name}
          value={value}
          placeholder={placeholder}
          onChange={(e) => setValue(e.target.value)}
          aria-invalid={error ? true : undefined}
        />
      </div>
      {error?.[0] ? <p className="text-destructive text-xs">{error[0]}</p> : null}
    </div>
  )
}
