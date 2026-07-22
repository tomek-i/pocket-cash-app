'use client'

import { Button, Card, cn } from '@repo/ui'
import {
  ArrowRight,
  BarChart3,
  Check,
  FileSpreadsheet,
  Shapes,
  Sparkles,
  Tags,
  Wallet,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { type ReactNode, useState, useTransition } from 'react'
import { completeOnboarding, type OnboardingChoice } from '../../_lib/onboarding-actions'

/**
 * First-run welcome tour, shown by the /app layout until onboarding is complete.
 * A short 3-slide carousel (plain `useState` stepping — no carousel primitive in
 * @repo/ui). The final slide lets the user start with demo data or a clean slate;
 * either way {@link completeOnboarding} persists the flag and reveals the app.
 */
export function Onboarding() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [choice, setChoice] = useState<OnboardingChoice>('demo')
  const [pending, startTransition] = useTransition()

  const isLast = step === SLIDES.length - 1

  const finish = () => {
    startTransition(async () => {
      await completeOnboarding(choice)
      router.refresh()
    })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-10">
      <Card className="w-full max-w-lg overflow-hidden p-0">
        <div className="flex flex-col gap-8 p-8">
          <div className="flex min-h-[19rem] flex-col">
            {step === 0 ? <WelcomeSlide /> : null}
            {step === 1 ? <FeaturesSlide /> : null}
            {step === 2 ? <ChoiceSlide choice={choice} onChoose={setChoice} /> : null}
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5">
              {SLIDES.map((_, i) => (
                <span
                  // biome-ignore lint/suspicious/noArrayIndexKey: fixed static list
                  key={i}
                  className={cn(
                    'h-1.5 rounded-full transition-all',
                    i === step ? 'w-5 bg-primary' : 'w-1.5 bg-muted-foreground/30',
                  )}
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              {step > 0 ? (
                <Button variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={pending}>
                  Back
                </Button>
              ) : null}
              {isLast ? (
                <Button className="gap-2" onClick={finish} disabled={pending}>
                  {pending ? 'Setting up…' : 'Get started'}
                  {pending ? null : <ArrowRight className="size-4" />}
                </Button>
              ) : (
                <Button className="gap-2" onClick={() => setStep((s) => s + 1)}>
                  Next
                  <ArrowRight className="size-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}

const SLIDES = [0, 1, 2]

function SlideHeading({
  icon,
  title,
  subtitle,
}: {
  icon: ReactNode
  title: string
  subtitle: string
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex size-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
        {icon}
      </div>
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">{title}</h1>
        <p className="mt-1 text-muted-foreground text-sm">{subtitle}</p>
      </div>
    </div>
  )
}

function WelcomeSlide() {
  return (
    <div className="flex flex-col gap-5">
      <SlideHeading
        icon={<Wallet className="size-6" />}
        title="Welcome to Pocket Cash"
        subtitle="Personal finance, in your pocket."
      />
      <p className="text-muted-foreground text-sm leading-relaxed">
        Track your spending, import bank statements, and see where your money goes. Everything lives
        on this device — nothing is uploaded, and nothing leaves your machine unless you choose to.
      </p>
    </div>
  )
}

const FEATURES: { icon: ReactNode; title: string; body: string }[] = [
  {
    icon: <FileSpreadsheet className="size-4" />,
    title: 'Import statements',
    body: 'Bring in CSV exports from any bank with reusable column mappings.',
  },
  {
    icon: <Shapes className="size-4" />,
    title: 'Categorise & tag',
    body: 'Organise transactions and spot recurring subscriptions.',
  },
  {
    icon: <BarChart3 className="size-4" />,
    title: 'Reports & insights',
    body: 'See trends by category and financial year, with optional AI summaries.',
  },
]

function FeaturesSlide() {
  return (
    <div className="flex flex-col gap-5">
      <SlideHeading
        icon={<Sparkles className="size-6" />}
        title="What you can do"
        subtitle="A quick tour of the essentials."
      />
      <div className="flex flex-col gap-3">
        {FEATURES.map((f) => (
          <div key={f.title} className="flex items-start gap-3">
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              {f.icon}
            </span>
            <div>
              <p className="font-medium text-sm">{f.title}</p>
              <p className="text-muted-foreground text-sm">{f.body}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ChoiceSlide({
  choice,
  onChoose,
}: {
  choice: OnboardingChoice
  onChoose: (choice: OnboardingChoice) => void
}) {
  return (
    <div className="flex flex-col gap-5">
      <SlideHeading
        icon={<Tags className="size-6" />}
        title="How would you like to start?"
        subtitle="You can change this anytime from Settings."
      />
      <div className="flex flex-col gap-3">
        <ChoiceCard
          selected={choice === 'demo'}
          onSelect={() => onChoose('demo')}
          title="Start with demo data"
          body="Explore with a realistic sample: two accounts, categories and a few months of transactions."
        />
        <ChoiceCard
          selected={choice === 'clean'}
          onSelect={() => onChoose('clean')}
          title="Start clean"
          body="An empty workspace. Add your own banks and import your statements when you're ready."
        />
      </div>
    </div>
  )
}

function ChoiceCard({
  selected,
  onSelect,
  title,
  body,
}: {
  selected: boolean
  onSelect: () => void
  title: string
  body: string
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'flex items-start gap-3 rounded-lg border p-4 text-left transition-colors',
        selected
          ? 'border-primary bg-primary/5 ring-1 ring-primary'
          : 'border-border hover:border-primary/40 hover:bg-muted/40',
      )}
    >
      <span
        className={cn(
          'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border',
          selected
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-muted-foreground/40',
        )}
      >
        {selected ? <Check className="size-3.5" /> : null}
      </span>
      <div>
        <p className="font-medium text-sm">{title}</p>
        <p className="text-muted-foreground text-sm">{body}</p>
      </div>
    </button>
  )
}
