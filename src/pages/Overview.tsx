import { useMemo, useState } from 'react'
import { analyze, type BucketPoint, type Breakdown } from '../lib/analytics.ts'
import { defaultFilters, resolveRange, type Filters } from '../lib/filters.ts'
import { fmtDate } from '../lib/dates.ts'
import { axisInr, inr, num } from '../lib/format.ts'
import { buildKpis, periodWord, ratioChange } from '../lib/kpis.ts'
import { buildTakeaway } from '../lib/takeaway.ts'
import type { Dataset } from '../lib/types.ts'
import { ChartCard } from '../components/ChartCard.tsx'
import { FilterBar } from '../components/filters/FilterBar.tsx'
import { KpiStrip } from '../components/KpiStrip.tsx'
import { Takeaway } from '../components/Takeaway.tsx'
import { EmptyState } from '../components/states.tsx'
import { BarList, type BarRow } from '../components/charts/BarList.tsx'
import { SegmentContribution } from '../components/charts/SegmentContribution.tsx'
import { SuccessDonut } from '../components/charts/SuccessDonut.tsx'
import { TrendChart, type TrendRow } from '../components/charts/TrendChart.tsx'

type ListKey = 'regions' | 'products' | 'segments' | 'channels'

export function Overview({ ds }: { ds: Dataset }) {
  const [filters, setFilters] = useState<Filters>(() => defaultFilters(ds))
  const [compare, setCompare] = useState(true)

  const range = useMemo(() => resolveRange(ds, filters), [ds, filters])
  const a = useMemo(() => analyze(ds, filters, range), [ds, filters, range])
  const kpis = useMemo(() => buildKpis(a), [a])
  const takeaway = useMemo(() => buildTakeaway(a, filters), [a, filters])

  // Cross-filtering: clicking a bar or segment pins the dashboard to it; clicking it again releases it.
  const pin = (key: ListKey, id: string) =>
    setFilters((f) => ({ ...f, [key]: f[key].length === 1 && f[key][0] === id ? [] : [id] }))

  const prevSeries = compare ? a.prev?.series : undefined
  const trend = (pick: (p: BucketPoint) => number): TrendRow[] =>
    a.cur.series.map((p, i) => ({ label: p.label, cur: pick(p), prev: prevSeries?.[i] ? pick(prevSeries[i]) : undefined }))

  const bars = (now: Breakdown[], before: Breakdown[] | undefined): BarRow[] => {
    const total = now.reduce((s, b) => s + b.revenue, 0)
    return [...now]
      .sort((x, y) => y.revenue - x.revenue)
      .map((b) => ({
        id: b.id,
        name: b.name,
        value: b.revenue,
        share: total ? b.revenue / total : 0,
        change: before ? ratioChange(b.revenue, before.find((p) => p.id === b.id)?.revenue ?? 0) : undefined,
      }))
  }
  const prevStats = compare ? a.prev : null

  return (
    <>
      <FilterBar ds={ds} filters={filters} range={range} comparable={a.comparable} compare={compare} onFilters={setFilters} onCompare={setCompare} />
      <main className="mx-auto max-w-[1280px] animate-enter space-y-8 px-4 pb-16 pt-6 sm:px-6">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight">Executive overview</h1>
          <p className="mt-1 text-sm text-muted">
            {fmtDate(a.range.start)} to {fmtDate(a.range.end)}
            {a.prev && ` compared with the previous ${periodWord(a.len)} (${fmtDate(a.prev.range.start)} to ${fmtDate(a.prev.range.end)})`}
          </p>
        </div>

        {a.cur.summary.txns === 0 ? (
          <EmptyState onReset={() => setFilters(defaultFilters(ds))} />
        ) : (
          <>
            <Takeaway takeaway={takeaway} />
            <KpiStrip kpis={kpis} compare={compare} />

            <div className="grid gap-4 lg:grid-cols-12">
              <ChartCard className="lg:col-span-7" title="Is revenue growing?" subtitle={`Fees earned on successful transactions, by ${a.timeline.gran}`}>
                <TrendChart data={trend((p) => p.revenue)} kind="area" format={inr} axis={axisInr} compare={compare} />
              </ChartCard>
              <ChartCard className="lg:col-span-5" title="How busy is the platform?" subtitle={`Transaction attempts, by ${a.timeline.gran}`}>
                <TrendChart data={trend((p) => p.txns)} kind="bar" format={num} axis={(n) => (n >= 1000 ? `${+(n / 1000).toFixed(1)}K` : String(n))} compare={compare} />
              </ChartCard>

              <ChartCard className="lg:col-span-4" title="Which products earn the most?" subtitle="Revenue and change vs previous period. Click to filter.">
                <BarList rows={bars(a.cur.byProduct, prevStats?.byProduct)} selected={filters.products} onSelect={(id) => pin('products', id)} format={inr} />
              </ChartCard>
              <ChartCard className="lg:col-span-4" title="Which regions earn the most?" subtitle="Revenue and change vs previous period. Click to filter.">
                <BarList rows={bars(a.cur.byRegion, prevStats?.byRegion)} selected={filters.regions} onSelect={(id) => pin('regions', id)} format={inr} />
              </ChartCard>
              <ChartCard className="lg:col-span-4" title="How reliable are transactions?" subtitle="Successful vs failed attempts">
                <SuccessDonut stats={a.cur} />
              </ChartCard>

              <ChartCard className="lg:col-span-12" title="Which customers drive revenue?" subtitle="Each segment's share of active customers against its share of revenue. Click a segment to filter.">
                <SegmentContribution segments={a.cur.bySegment} onSelect={(id) => pin('segments', id)} />
              </ChartCard>
            </div>
          </>
        )}

        <footer className="border-t border-line pt-5 text-sm text-muted">
          <p className="max-w-3xl">
            All data is synthetic, generated by scripts/build_dataset.py. Revenue is the sum of fees on successful transactions. An active customer has at least one successful transaction in the period. Comparisons use the immediately preceding window of equal length and are not adjusted for seasonality.
          </p>
        </footer>
      </main>
    </>
  )
}
