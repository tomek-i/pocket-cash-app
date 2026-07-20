'use client'

import { Button } from '@repo/ui'
import { Sparkles } from 'lucide-react'
import { useTransition } from 'react'
import { seedDefaultCategories } from '../actions'

export function SeedDefaultsButton() {
  const [pending, startTransition] = useTransition()

  return (
    <Button
      className="gap-2"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await seedDefaultCategories()
        })
      }
    >
      <Sparkles className="size-4" />
      {pending ? 'Adding…' : 'Add default categories'}
    </Button>
  )
}
