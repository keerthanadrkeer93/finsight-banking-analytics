import type { Kpi, Trend } from '../lib/kpis.ts'
import { Icon } from './icons.tsx'
import { Sparkline } from './charts/Sparkline.tsx'

const BADGE: Record<Trend, { icon: 'up' | 'down' | 'right'; cls: string; word: string }> = {
  improved: { icon: 'up', cls: 'bg-good-soft text-good', word: 'Improved' },
  declined: { icon: 'down', cls: 'bg-bad-soft text-bad', word: 'Declined' },
  stable: { icon: 'right', cls: 'bg-bg text-muted', word: 'Stable' },
}

function TrendBadge({ trend, change }: { trend: Trend; change: string | null }) {
  const b = BADGE[trend]
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${b.cls}`}>
      <Icon name={b.icon} className="h-3 w-3" />
      {b.word}
      {change && <span className="font-normal tabular-nums">{change}</span>}
    </span>
  )
}

/** Six KPIs in one bordered strip (hairline dividers come from the grid gap), instead of six separate cards. */
export function KpiStrip({ kpis, compare }: { kpis: Kpi[]; compare: boolean }) {
  return (
    <section aria-label="Key metrics" className="overflow-hidden rounded-lg border border-line bg-line shadow-card">
      <div className="grid grid-cols-2 gap-px lg:grid-cols-3 xl:grid-cols-6">
        {kpis.map((k) => {
          const isGrowth = k.id === 'growth'
          const showBadge = k.trend !== null && (compare || isGrowth)
          return (
            <div key={k.id} title={k.hint} className="flex min-w-0 flex-col bg-surface p-4">
              <p className="truncate text-sm text-muted">{k.label}</p>
              <p className="mt-1 text-[26px] font-semibold leading-tight tracking-tight tabular-nums">{k.value}</p>
              <div className="mt-2 min-h-[22px]">{showBadge && k.trend && <TrendBadge trend={k.trend} change={isGrowth ? null : k.change} />}</div>
              <p className="mt-1 min-h-[16px] truncate text-xs text-muted">{(compare || isGrowth) && k.versus}</p>
              <div className="mt-2 min-h-9">{k.spark && k.spark.length > 2 && <Sparkline data={k.spark} />}</div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
