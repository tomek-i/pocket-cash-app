import { cn } from '@repo/ui'

export interface DonutSlice {
  label: string
  value: number
  color: string
}

/** Lightweight SVG donut — no charting dependency. */
export function DonutChart({
  data,
  centerValue,
  centerLabel,
  className,
}: {
  data: DonutSlice[]
  centerValue?: string
  centerLabel?: string
  className?: string
}) {
  const total = data.reduce((sum, s) => sum + s.value, 0) || 1
  const radius = 52
  const circumference = 2 * Math.PI * radius
  let offset = 0

  return (
    <div className={cn('relative size-40', className)}>
      <svg viewBox="0 0 140 140" className="-rotate-90 size-full" role="img">
        <title>Spending by category</title>
        <circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          stroke="var(--color-muted)"
          strokeWidth="16"
        />
        {data.map((slice) => {
          const fraction = slice.value / total
          const dash = fraction * circumference
          const dashoffset = -offset * circumference
          offset += fraction
          return (
            <circle
              key={slice.label}
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke={slice.color}
              strokeWidth="16"
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={dashoffset}
              strokeLinecap="butt"
            />
          )
        })}
      </svg>
      {centerValue || centerLabel ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {centerValue ? (
            <span className="font-semibold text-foreground text-xl tracking-tight">
              {centerValue}
            </span>
          ) : null}
          {centerLabel ? (
            <span className="text-[11px] text-muted-foreground">{centerLabel}</span>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

/** Sparkline-style vertical bars for the net-worth trend. */
export function MiniBars({
  values,
  highlightIndex,
  className,
}: {
  values: number[]
  highlightIndex?: number
  className?: string
}) {
  const max = Math.max(...values, 1)
  return (
    <div className={cn('flex h-14 items-end gap-1.5', className)}>
      {values.map((value, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length ordered series
          key={i}
          className={cn(
            'flex-1 rounded-sm transition-colors',
            i === highlightIndex ? 'bg-primary' : 'bg-muted-foreground/25',
          )}
          style={{ height: `${Math.max((value / max) * 100, 6)}%` }}
        />
      ))}
    </div>
  )
}
