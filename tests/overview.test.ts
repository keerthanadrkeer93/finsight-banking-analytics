/**
 * Regression tests for the Executive Overview analytics.
 *
 * Expected values marked "pandas" were computed independently from data/*.csv with pandas,
 * not with the code under test, so these tests fail if the TypeScript logic drifts.
 * The dataset is loaded through the app's real loader (loadDataset), so CSV parsing is covered too.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { analyze } from '../src/lib/analytics.ts'
import { toDay } from '../src/lib/dates.ts'
import { buildDataset } from '../src/lib/dataset.ts'
import { defaultFilters, resolveRange, type Filters } from '../src/lib/filters.ts'
import { buildKpis, ratioChange, trendOf } from '../src/lib/kpis.ts'
import { loadDataset } from '../src/lib/loadData.ts'
import { buildTakeaway } from '../src/lib/takeaway.ts'
import type { Dataset } from '../src/lib/types.ts'

let ds: Dataset
beforeAll(async () => {
  ds = await loadDataset()
})

const filters = (patch: Partial<Filters> = {}): Filters => ({ ...defaultFilters(ds), ...patch })
const run = (patch: Partial<Filters> = {}) => {
  const f = filters(patch)
  return { f, a: analyze(ds, f, resolveRange(ds, f)) }
}

describe('dataset loading', () => {
  it('loads all five CSVs and joins them', () => {
    expect(ds.txns).toHaveLength(20407)
    expect(ds.customerCount).toBe(3000)
    expect(ds.products).toHaveLength(6)
    expect(ds.regions).toHaveLength(5)
    expect(ds.channels).toHaveLength(5)
    expect(ds.names['P01']).toBe('Instant Credit')
  })
  it('spans 2024-10-01 to 2026-09-30', () => {
    expect(ds.minDay).toBe(toDay('2024-10-01'))
    expect(ds.maxDay).toBe(toDay('2026-09-30'))
  })
})

describe('all-time baselines (pandas)', () => {
  const s = () => run({ preset: 'all' }).a.cur.summary
  it('revenue is the sum of fees on successful transactions', () => expect(Math.round(s().revenue)).toBe(860832))
  it('counts every attempt', () => {
    expect(s().txns).toBe(20407)
    expect(s().successful).toBe(19585)
    expect(s().failed).toBe(822)
  })
  it('success rate is about 95.97%', () => expect(s().successRate).toBeCloseTo(0.95972, 4))
  it('successful transaction value is 79,333,764', () => expect(Math.round(s().avgTicket * s().successful)).toBe(79333764))
})

describe('12-month period and previous-period comparison (pandas)', () => {
  it('current period', () => {
    const c = run().a.cur.summary
    expect(c.revenue).toBeCloseTo(467664.32, 2)
    expect(c.txns).toBe(10694)
    expect(c.activeCustomers).toBe(2119)
    expect(c.avgTicket).toBeCloseTo(4098.74, 2)
    expect(c.successRate).toBeCloseTo(0.957827, 5)
  })
  it('previous period is the contiguous window of equal length', () => {
    const { a } = run()
    expect(a.prev).not.toBeNull()
    expect(a.prev!.range.end).toBe(a.range.start - 1)
    expect(a.prev!.range.end - a.prev!.range.start + 1).toBe(a.len)
    expect(a.prev!.summary.revenue).toBeCloseTo(393167.18, 2)
    expect(a.prev!.summary.txns).toBe(9713)
    expect(a.prev!.summary.activeCustomers).toBe(2033)
  })
  it('revenue growth and badges', () => {
    const k = Object.fromEntries(buildKpis(run().a).map((x) => [x.id, x]))
    expect(k.growth.value).toBe('+18.9%')
    expect(k.growth.trend).toBe('improved')
    expect(k.revenue.trend).toBe('improved')
    expect(k.revenue.change).toBe('+18.9%')
    expect(k.success.trend).toBe('stable') // -0.4 pp is inside the +/-0.5 pp dead-band
  })
  it('a quarter is compared with the quarter before it (pandas)', () => {
    const { a } = run({ preset: 'custom', custom: { start: toDay('2026-01-01'), end: toDay('2026-03-31') } })
    expect(a.cur.summary.revenue).toBeCloseTo(107837.28, 2)
    expect(a.prev!.summary.revenue).toBeCloseTo(125399.68, 2)
  })
  it('no comparison when there is not enough earlier history', () => {
    expect(run({ preset: 'all' }).a.prev).toBeNull()
    expect(run({ preset: 'custom', custom: { start: toDay('2025-06-01'), end: toDay('2026-09-30') } }).a.comparable).toBe(false)
    const k = Object.fromEntries(buildKpis(run({ preset: 'all' }).a).map((x) => [x.id, x]))
    expect(k.growth.value).toBe('n/a')
    expect(k.growth.trend).toBeNull()
    expect(k.revenue.change).toBeNull()
  })
  it('previous-period series lines up bucket for bucket and adds back to its total', () => {
    const { a } = run()
    expect(a.timeline.gran).toBe('month')
    expect(a.cur.series).toHaveLength(12)
    expect(a.prev!.series).toHaveLength(12)
    const sum = (s: { revenue: number }[]) => s.reduce((t, p) => t + p.revenue, 0)
    expect(sum(a.prev!.series)).toBeCloseTo(a.prev!.summary.revenue, 6)
    expect(sum(a.cur.series)).toBeCloseTo(a.cur.summary.revenue, 6)
  })
})

describe('date ranges', () => {
  it('presets end on the last day of data and have the right length', () => {
    expect(resolveRange(ds, filters({ preset: '30d' }))).toEqual({ start: ds.maxDay - 29, end: ds.maxDay })
    expect(run({ preset: '30d' }).a.timeline.gran).toBe('week')
    expect(run({ preset: '30d' }).a.cur.summary.revenue).toBeCloseTo(42803.97, 2)
  })
  it('swaps a reversed custom range', () => {
    const r = resolveRange(ds, filters({ preset: 'custom', custom: { start: toDay('2026-03-31'), end: toDay('2026-01-01') } }))
    expect(r).toEqual({ start: toDay('2026-01-01'), end: toDay('2026-03-31') })
  })
  it('clamps a custom range to the data', () => {
    const r = resolveRange(ds, filters({ preset: 'custom', custom: { start: toDay('2020-01-01'), end: toDay('2030-01-01') } }))
    expect(r).toEqual({ start: ds.minDay, end: ds.maxDay })
  })
  it('handles a single day, and a range entirely after the data (empty, not an error)', () => {
    expect(run({ preset: 'custom', custom: { start: ds.maxDay, end: ds.maxDay } }).a.cur.summary.txns).toBeGreaterThan(0)
    const after = run({ preset: 'custom', custom: { start: ds.maxDay + 100, end: ds.maxDay + 200 } }).a
    expect(after.cur.summary.txns).toBe(0)
    expect(JSON.stringify(buildKpis(after))).not.toMatch(/NaN|Infinity|undefined/)
  })
})

describe('filters (pandas)', () => {
  it('region', () => {
    const c = run({ regions: ['R3'] }).a // East
    expect(c.cur.summary.revenue).toBeCloseTo(44456.78, 2)
    expect(c.cur.summary.txns).toBe(1070)
    expect(c.prev!.summary.revenue).toBeCloseTo(51248.82, 2)
  })
  it('channel', () => {
    const c = run({ channels: ['CH1'] }).a.cur.summary // Mobile App
    expect(c.txns).toBe(4178)
    expect(c.successRate).toBeCloseTo(0.943035, 5)
    expect(c.revenue).toBeCloseTo(218711.28, 2)
  })
  it('segment', () => expect(run({ segments: ['High Value'] }).a.cur.summary.revenue).toBeCloseTo(200910.02, 2))
  it('product', () => {
    const c = run({ products: ['P05'] }).a // Legacy Wallet
    expect(c.cur.summary.revenue).toBeCloseTo(13176.54, 2)
    expect(c.prev!.summary.revenue).toBeCloseTo(24423.38, 2)
  })
  it('combined filters', () => expect(run({ segments: ['Premium'], products: ['P01'] }).a.cur.summary.revenue).toBeCloseTo(41256.1, 2))
  it('multi-select is a union', () => expect(run({ regions: ['R1', 'R2'] }).a.cur.summary.revenue).toBeCloseTo(237442.44, 2))
  it('dimensions partition the total (nothing double-counted or lost)', () => {
    const { a } = run()
    const total = a.cur.summary.revenue
    for (const rows of [a.cur.byProduct, a.cur.byRegion, a.cur.bySegment, a.cur.byChannel]) {
      expect(rows.reduce((s, r) => s + r.revenue, 0)).toBeCloseTo(total, 6)
      expect(rows.reduce((s, r) => s + r.txns, 0)).toBe(a.cur.summary.txns)
    }
  })
})

describe('row-level rules on a hand-built dataset', () => {
  const tiny = buildDataset({
    customers: [
      { customer_id: 'C1', region_id: 'R1', segment: 'Premium' },
      { customer_id: 'C2', region_id: 'R2', segment: 'Standard' },
    ],
    transactions: [
      { transaction_id: 'T1', customer_id: 'C1', product_id: 'P01', channel_id: 'CH1', txn_date: '2026-09-01', amount: '1000', fee: '20', status: 'success', failure_reason: '' },
      { transaction_id: 'T2', customer_id: 'C1', product_id: 'P01', channel_id: 'CH1', txn_date: '2026-09-02', amount: '500', fee: '0', status: 'failed', failure_reason: 'Authentication Failure' },
      { transaction_id: 'T3', customer_id: 'C2', product_id: 'P01', channel_id: 'CH1', txn_date: '2026-09-02', amount: '3000', fee: '30', status: 'success', failure_reason: '' },
      { transaction_id: 'T4', customer_id: 'C9', product_id: 'P01', channel_id: 'CH1', txn_date: '2026-09-02', amount: '999', fee: '9', status: 'success', failure_reason: '' },
    ],
    products: [{ product_id: 'P01', product_name: 'Instant Credit' }],
    regions: [{ region_id: 'R1', region_name: 'North' }, { region_id: 'R2', region_name: 'South' }],
    channels: [{ channel_id: 'CH1', channel_name: 'Mobile App' }],
  })
  const s = () => analyze(tiny, defaultFilters(tiny), { start: tiny.minDay, end: tiny.maxDay }).cur.summary
  it('drops transactions whose customer does not exist', () => expect(tiny.txns).toHaveLength(3))
  it('failed transactions earn no revenue and are excluded from average value', () => {
    expect(s().revenue).toBe(50)
    expect(s().avgTicket).toBe(2000) // (1000 + 3000) / 2; the failed 500 is ignored
  })
  it('success rate counts every attempt', () => {
    expect(s().txns).toBe(3)
    expect(s().successful).toBe(2)
    expect(s().successRate).toBeCloseTo(2 / 3, 10)
  })
  it('active customers are customers with a successful transaction', () => expect(s().activeCustomers).toBe(2))
  it('a customer with only failed transactions is not active', () => {
    const f = { ...defaultFilters(tiny), segments: ['Premium'] }
    const only = analyze(tiny, f, { start: tiny.maxDay, end: tiny.maxDay }) // 2 Sep: C1 failed, C2 succeeded
    expect(only.cur.summary.activeCustomers).toBe(0)
    expect(only.cur.summary.txns).toBe(1)
  })
})

describe('empty selections and zero denominators', () => {
  const empty = () => run({ regions: ['R3'], channels: ['CH3'], products: ['P06'], preset: 'custom', custom: { start: ds.maxDay - 6, end: ds.maxDay } })
  it('an empty selection yields zeros, never NaN', () => {
    const s = empty().a.cur.summary
    expect(s.txns).toBe(0)
    expect(s.revenue).toBe(0)
    expect(s.successRate).toBe(0)
    expect(s.avgTicket).toBe(0)
    expect(s.activeCustomers).toBe(0)
  })
  it('KPI and takeaway text never contains NaN, Infinity or undefined', () => {
    const { a, f } = empty()
    expect(JSON.stringify([buildKpis(a), buildTakeaway(a, f)])).not.toMatch(/NaN|Infinity|undefined/)
  })
  it('takeaway admits when there is too little data', () => {
    const { a, f } = empty()
    expect(buildTakeaway(a, f).headline).toMatch(/too little data/i)
  })
  it('ratio helpers refuse to divide by zero', () => {
    expect(ratioChange(5, 0)).toBeNull()
    expect(trendOf(null, 0.01)).toBeNull()
    expect(trendOf(0.004, 0.01)).toBe('stable')
    expect(trendOf(-0.05, 0.01)).toBe('declined')
  })
  it('a dataset with no rows does not crash', () => {
    const none = buildDataset({ customers: [], transactions: [], products: [], regions: [], channels: [] })
    const f = defaultFilters(none)
    const a = analyze(none, f, resolveRange(none, f))
    expect(a.cur.summary.txns).toBe(0)
    expect(a.comparable).toBe(false)
    expect(buildKpis(a)).toHaveLength(6)
    expect(buildTakeaway(a, f).tone).toBe('info')
  })
})

describe('key takeaway is computed from the data', () => {
  it('12 months: revenue rose, with a driver and a watch-out', () => {
    const { a, f } = run()
    const t = buildTakeaway(a, f)
    expect(t.tone).toBe('up')
    expect(t.headline).toMatch(/rose 18\.9%/)
    expect(t.details.map((d) => d.label)).toEqual(['Driver', 'Watch-out'])
    expect(t.details[0].text).toContain('Instant Credit')
    expect(t.details[1].text).toContain('Mobile App')
  })
  it('does not name a dimension that is already filtered to a single member', () => {
    const { a, f } = run({ products: ['P01'] })
    expect(buildTakeaway(a, f).details.find((d) => d.label === 'Driver')?.text ?? '').not.toContain('Instant Credit')
  })
  it('all-time has no previous period, so it describes instead of comparing', () => {
    const { a, f } = run({ preset: 'all' })
    const t = buildTakeaway(a, f)
    expect(t.tone).toBe('info')
    expect(t.details.some((d) => d.label === 'Driver')).toBe(false)
  })
  it('a falling window reads as a decline', () => {
    const { a, f } = run({ preset: 'custom', custom: { start: toDay('2026-01-01'), end: toDay('2026-03-31') } })
    expect(buildTakeaway(a, f).tone).toBe('down') // Q1 vs the festive quarter before it
  })
})
