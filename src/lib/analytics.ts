import { fmtShort, monthIndex, monthLabel } from './dates.ts'
import type { Filters, Range } from './filters.ts'
import { SEGMENTS, type Dataset, type Lookup, type Txn } from './types.ts'

export interface Timeline {
  gran: 'month' | 'week'
  count: number
  labels: string[]
  index: (day: number) => number
}
export interface Summary {
  revenue: number // sum of fees on successful transactions
  txns: number // all attempts
  successful: number
  failed: number
  successRate: number
  activeCustomers: number // distinct customers with >= 1 successful transaction
  avgTicket: number // mean amount of successful transactions
}
export interface BucketPoint {
  label: string
  revenue: number
  txns: number
  active: number
  avgTicket: number
  successRate: number
}
export interface Breakdown {
  id: string
  name: string
  revenue: number
  txns: number
  failed: number
  active: number
}
export interface Reason {
  reason: string
  count: number
}
export interface PeriodStats {
  range: Range
  summary: Summary
  series: BucketPoint[]
  byProduct: Breakdown[]
  byRegion: Breakdown[]
  bySegment: Breakdown[]
  byChannel: Breakdown[]
  reasons: Reason[]
  channelReasons: Record<string, Reason[]>
}
export interface Analysis {
  range: Range
  len: number
  timeline: Timeline
  cur: PeriodStats
  prev: PeriodStats | null // null when there is not enough earlier history
  comparable: boolean
}

/** Months for windows over ~4 months, otherwise 7-day weeks. */
export function buildTimeline(range: Range): Timeline {
  const len = range.end - range.start + 1
  if (len > 120) {
    const first = monthIndex(range.start)
    const count = monthIndex(range.end) - first + 1
    return {
      gran: 'month',
      count,
      labels: Array.from({ length: count }, (_, k) => monthLabel(first + k)),
      index: (d) => monthIndex(d) - first,
    }
  }
  const count = Math.ceil(len / 7)
  return {
    gran: 'week',
    count,
    labels: Array.from({ length: count }, (_, k) => fmtShort(range.start + 7 * k)),
    index: (d) => Math.floor((d - range.start) / 7),
  }
}

interface Acc {
  revenue: number
  txns: number
  failed: number
  cust: Set<string>
}
const bump = (m: Map<string, Acc>, key: string, t: Txn) => {
  let a = m.get(key)
  if (!a) m.set(key, (a = { revenue: 0, txns: 0, failed: 0, cust: new Set() }))
  a.txns++
  if (t.ok) {
    a.revenue += t.fee
    a.cust.add(t.customerId)
  } else a.failed++
}
const toRows = (list: Lookup[], m: Map<string, Acc>): Breakdown[] =>
  list.map((l) => {
    const a = m.get(l.id)
    return { id: l.id, name: l.name, revenue: a?.revenue ?? 0, txns: a?.txns ?? 0, failed: a?.failed ?? 0, active: a?.cust.size ?? 0 }
  })
const sortReasons = (m: Map<string, number>): Reason[] =>
  [...m].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count)

/**
 * One pass over the transactions: apply every filter, then accumulate the summary,
 * the time series and every breakdown. `shift` moves the previous period onto the
 * current period's timeline so the two series line up bucket for bucket.
 */
function computePeriod(ds: Dataset, f: Filters, range: Range, tl: Timeline, shift: number): PeriodStats {
  const rs = f.regions.length ? new Set(f.regions) : null
  const ps = f.products.length ? new Set(f.products) : null
  const ss = f.segments.length ? new Set<string>(f.segments) : null
  const cs = f.channels.length ? new Set(f.channels) : null

  const n = tl.count
  const rev = new Array<number>(n).fill(0)
  const cnt = new Array<number>(n).fill(0)
  const okc = new Array<number>(n).fill(0)
  const amt = new Array<number>(n).fill(0)
  const bucketCust = Array.from({ length: n }, () => new Set<string>())
  const prod = new Map<string, Acc>(), reg = new Map<string, Acc>(), seg = new Map<string, Acc>(), chn = new Map<string, Acc>()
  const reasons = new Map<string, number>()
  const chReasons = new Map<string, Map<string, number>>()
  const active = new Set<string>()
  let revenue = 0, txns = 0, ok = 0, amount = 0

  for (const t of ds.txns) {
    if (t.day < range.start || t.day > range.end) continue
    if (rs && !rs.has(t.regionId)) continue
    if (ps && !ps.has(t.productId)) continue
    if (ss && !ss.has(t.segment)) continue
    if (cs && !cs.has(t.channelId)) continue
    const k = tl.index(t.day + shift)
    if (k < 0 || k >= n) continue

    txns++
    cnt[k]++
    bump(prod, t.productId, t)
    bump(reg, t.regionId, t)
    bump(seg, t.segment, t)
    bump(chn, t.channelId, t)
    if (t.ok) {
      ok++
      revenue += t.fee
      amount += t.amount
      rev[k] += t.fee
      okc[k]++
      amt[k] += t.amount
      bucketCust[k].add(t.customerId)
      active.add(t.customerId)
    } else {
      reasons.set(t.reason, (reasons.get(t.reason) ?? 0) + 1)
      let m = chReasons.get(t.channelId)
      if (!m) chReasons.set(t.channelId, (m = new Map()))
      m.set(t.reason, (m.get(t.reason) ?? 0) + 1)
    }
  }

  return {
    range,
    summary: {
      revenue,
      txns,
      successful: ok,
      failed: txns - ok,
      successRate: txns ? ok / txns : 0,
      activeCustomers: active.size,
      avgTicket: ok ? amount / ok : 0,
    },
    series: Array.from({ length: n }, (_, k) => ({
      label: tl.labels[k],
      revenue: rev[k],
      txns: cnt[k],
      active: bucketCust[k].size,
      avgTicket: okc[k] ? amt[k] / okc[k] : 0,
      successRate: cnt[k] ? okc[k] / cnt[k] : 0,
    })),
    byProduct: toRows(ds.products, prod),
    byRegion: toRows(ds.regions, reg),
    bySegment: toRows(SEGMENTS.map((s) => ({ id: s, name: s })), seg),
    byChannel: toRows(ds.channels, chn),
    reasons: sortReasons(reasons),
    channelReasons: Object.fromEntries([...chReasons].map(([id, m]) => [id, sortReasons(m)])),
  }
}

/** Current period plus the immediately preceding window of equal length. */
export function analyze(ds: Dataset, f: Filters, range: Range): Analysis {
  const len = range.end - range.start + 1
  const timeline = buildTimeline(range)
  const cur = computePeriod(ds, f, range, timeline, 0)
  const prevRange = { start: range.start - len, end: range.start - 1 }
  const comparable = prevRange.start >= ds.minDay // comparing against a half-empty window would be misleading
  const prev = comparable ? computePeriod(ds, f, prevRange, timeline, len) : null
  return { range, len, timeline, cur, prev, comparable }
}
