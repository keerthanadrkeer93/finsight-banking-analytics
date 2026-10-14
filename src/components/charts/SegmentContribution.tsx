import type { Breakdown } from '../../lib/analytics.ts'

const COLOR: Record<string, { bg: string; fg: string }> = {
  Premium: { bg: '#0b3a4d', fg: '#ffffff' },
  'High Value': { bg: '#1b86a3', fg: '#ffffff' },
  Standard: { bg: '#b6d3de', fg: '#0c1a26' },
}

interface Part {
  id: string
  share: number
}
function Stack({ label, parts, onSelect }: { label: string; parts: Part[]; onSelect: (id: string) => void }) {
  return (
    <div>
      <p className="mb-1.5 text-sm text-muted">{label}</p>
      <div className="flex h-10 gap-px overflow-hidden rounded-md" role="group" aria-label={label}>
        {parts.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelect(p.id)}
            title={`${p.id}: ${(p.share * 100).toFixed(1)}%`}
            className="grid place-content-center text-sm font-medium tabular-nums transition-[width] duration-500 hover:brightness-110"
            style={{ width: `${p.share * 100}%`, background: COLOR[p.id].bg, color: COLOR[p.id].fg }}
          >
            {p.share >= 0.07 ? `${(p.share * 100).toFixed(0)}%` : ''}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Share of active customers vs share of revenue, per value segment. The gap between the two bars is the story. */
export function SegmentContribution({ segments, onSelect }: { segments: Breakdown[]; onSelect: (id: string) => void }) {
  const custTotal = segments.reduce((s, b) => s + b.active, 0)
  const revTotal = segments.reduce((s, b) => s + b.revenue, 0)
  const rows = segments.map((b) => {
    const cust = custTotal ? b.active / custTotal : 0
    const rev = revTotal ? b.revenue / revTotal : 0
    return { id: b.id, cust, rev, index: cust > 0 ? rev / cust : 0 }
  })
  return (
    <div>
      <div className="space-y-4">
        <Stack label="Share of active customers" parts={rows.map((r) => ({ id: r.id, share: r.cust }))} onSelect={onSelect} />
        <Stack label="Share of revenue" parts={rows.map((r) => ({ id: r.id, share: r.rev }))} onSelect={onSelect} />
      </div>
      <dl className="mt-5 grid gap-4 border-t border-line pt-4 sm:grid-cols-3">
        {rows.map((r) => (
          <div key={r.id}>
            <dt className="flex items-center gap-2 text-sm font-medium">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: COLOR[r.id].bg }} />
              {r.id}
            </dt>
            <dd className="mt-1 text-sm text-muted">
              <span className="text-xl font-semibold tabular-nums text-ink">{r.index.toFixed(1)}×</span> the average revenue per customer
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
