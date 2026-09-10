'use client'

import { Button } from '@repo/ui'
import { useActionState, useEffect, useState } from 'react'
import type { ActionState } from '@/lib/action-state'
import { formatPlaceholder } from '@/lib/number-format'
import { Field } from '../../banks/_components/form-field'
import { type AppSettingsView, updateSettings } from '../actions'

export function GeneralSettings({
  settings,
  systemLocale,
}: {
  settings: AppSettingsView
  /** Resolved on the server, which on this app is the user's own machine. */
  systemLocale: string
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(updateSettings, null)
  const [saved, setSaved] = useState(false)

  const example = formatPlaceholder(1234567.89, settings.numberLocale || systemLocale)

  useEffect(() => {
    if (!state?.ok) return
    setSaved(true)
    const t = setTimeout(() => setSaved(false), 2500)
    return () => clearTimeout(t)
  }, [state])

  return (
    <form action={formAction} className="grid max-w-xs gap-4">
      <Field
        label="Default currency"
        name="defaultCurrency"
        defaultValue={state?.values?.defaultCurrency ?? settings.defaultCurrency}
        placeholder="USD"
        error={state?.errors?.defaultCurrency}
      />
      <Field
        label="Number format"
        name="numberLocale"
        defaultValue={state?.values?.numberLocale ?? settings.numberLocale}
        placeholder={systemLocale}
        error={state?.errors?.numberLocale}
      />
      <p className="-mt-2 text-muted-foreground text-xs">
        A language tag such as en-AU or de-DE, deciding how amounts are grouped. Leave it empty to
        follow this computer, which currently formats as {example}.
      </p>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save'}
        </Button>
        {saved ? <span className="text-success text-sm">Saved</span> : null}
      </div>
    </form>
  )
}
