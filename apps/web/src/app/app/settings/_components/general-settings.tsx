'use client'

import { Button } from '@repo/ui'
import { useActionState, useEffect, useState } from 'react'
import type { ActionState } from '@/lib/action-state'
import { Field } from '../../banks/_components/form-field'
import { type AppSettingsView, updateSettings } from '../actions'

export function GeneralSettings({ settings }: { settings: AppSettingsView }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(updateSettings, null)
  const [saved, setSaved] = useState(false)

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
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save'}
        </Button>
        {saved ? <span className="text-success text-sm">Saved</span> : null}
      </div>
    </form>
  )
}
