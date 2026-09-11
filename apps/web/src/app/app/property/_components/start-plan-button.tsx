'use client'

import { Button } from '@repo/ui'
import { PencilRuler } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { startPlan } from '../actions'

/**
 * One click from "what could I afford" to the planner.
 *
 * Deliberately no dialog. A plan you have to fill in a form to start is a plan
 * you do not start, and the whole point is somewhere to push numbers around
 * before any particular house exists. The name and address are asked for later,
 * if the plan ever becomes a purchase you are actually pursuing.
 */
export function StartPlanButton({ variant = 'outline' }: { variant?: 'outline' | 'default' }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <Button
      variant={variant}
      className="gap-2"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const id = await startPlan()
          router.push(`/app/property/${id}/planner`)
        })
      }
    >
      <PencilRuler className="size-4" />
      {pending ? 'Starting…' : 'Start a plan'}
    </Button>
  )
}
