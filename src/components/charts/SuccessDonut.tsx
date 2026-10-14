import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts'
import type { PeriodStats } from '../../lib/analytics.ts'
import { num, pct } from '../../lib/format.ts'

export function SuccessDonut({ stats }: { stats: PeriodStats }) {
  const { successful, failed, successRate } = stats.summary
  const data = [
    { name: 'Successful', value: successful, color: '#0b5f7a' },
    { name: 'Failed', value: failed, color: '#c2410c' },
  ]
  const topReasons = stats.reasons.slice(0, 3)
  return (
    <div>
      <div className="relative mx-auto h-40 w-40" role="img" aria-label={`${pct(successRate)} of transactions succeeded`}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" innerRadius="74%" outerRadius="100%" startAngle={90} endAngle={-270} stroke="none" animationDuration={500}>
              {data.map((d) => <Cell key={d.name} fill={d.color} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
          <p className="text-2xl font-semibold tabular-nums">{pct(successRate)}</p>
          <p className="text-xs text-muted">succeeded</p>
        </div>
      </div>
      <dl className="mt-4 space-y-1.5 text-sm">
        {data.map((d) => (
          <div key={d.name} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: d.color }} />
            <dt className="text-muted">{d.name}</dt>
            <dd className="ml-auto font-medium tabular-nums">{num(d.value)}</dd>
          </div>
        ))}
      </dl>
      {topReasons.length > 0 && (
        <div className="mt-4 border-t border-line pt-3">
          <p className="mb-1.5 text-sm font-medium">Why transactions fail</p>
          <ul className="space-y-1 text-sm text-muted">
            {topReasons.map((r) => (
              <li key={r.reason} className="flex justify-between gap-3">
                <span className="truncate">{r.reason}</span>
                <span className="tabular-nums text-ink">{pct(r.count / failed, 0)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
