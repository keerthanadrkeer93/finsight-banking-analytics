import type { Analysis } from './analytics.ts'
import { inr, inrFull, num, pct, pp, signedPct } from './format.ts'

export type Trend = 'improved' | 'declined' | 'stable'

/** Direction of a change, with a dead-band so tiny movements read as "stable". */
export const trendOf = (change: number | null, threshold: number): Trend | null =>
  change === null ? null : Math.abs(change) < threshold ? 'stable' : change > 0 ? 'improved' : 'declined'

export const STABLE_RATIO = 0.01 // within +/-1% of the previous value
export const STABLE_RATE = 0.005 // within +/-0.5 percentage points

export const ratioChange = (cur: number, prev: number): number | null => (prev > 0 ? cur / prev - 1 : null)

export interface Kpi {
  id: string
  label: string
  value: string
  trend: Trend | null
  change: string | null
  versus: string | null // short "vs previous" context line
  spark: number[] | null
  hint: string
}

export const periodWord = (len: number): string => (len >= 360 && len <= 370 ? '12 months' : `${len} days`)

export function buildKpis(a: Analysis): Kpi[] {
  const { cur, prev } = a
  const c = cur.summary
  const p = prev?.summary ?? null

  // Count/amount KPIs share one rule: relative change vs previous, "higher is better".
  const ratioKpi = (id: string, label: string, hint: string, now: number, before: number | undefined, fmt: (n: number) => string, spark: number[]): Kpi => {
    const change = before === undefined ? null : ratioChange(now, before)
    return {
      id, label, hint,
      value: fmt(now),
      trend: trendOf(change, STABLE_RATIO),
      change: change === null ? null : signedPct(change),
      versus: before === undefined ? null : `vs ${fmt(before)}`,
      spark,
    }
  }

  const growth = p ? ratioChange(c.revenue, p.revenue) : null
  const successDelta = p ? c.successRate - p.successRate : null

  return [
    ratioKpi('revenue', 'Total revenue', 'Sum of fees earned on successful transactions', c.revenue, p?.revenue, inr, cur.series.map((s) => s.revenue)),
    ratioKpi('txns', 'Transaction volume', 'All transaction attempts, successful or failed', c.txns, p?.txns, num, cur.series.map((s) => s.txns)),
    ratioKpi('active', 'Active customers', 'Customers with at least one successful transaction in the period', c.activeCustomers, p?.activeCustomers, num, cur.series.map((s) => s.active)),
    ratioKpi('avg', 'Avg transaction value', 'Mean amount of successful transactions', c.avgTicket, p?.avgTicket, inrFull, cur.series.map((s) => s.avgTicket)),
    {
      id: 'success', label: 'Success rate', hint: 'Successful transactions as a share of all attempts',
      value: pct(c.successRate),
      trend: trendOf(successDelta, STABLE_RATE),
      change: successDelta === null ? null : pp(successDelta),
      versus: p ? `vs ${pct(p.successRate)}` : null,
      spark: cur.series.map((s) => s.successRate),
    },
    {
      id: 'growth', label: 'Revenue growth', hint: 'Change in revenue versus the previous period of equal length',
      value: growth === null ? 'n/a' : signedPct(growth),
      trend: trendOf(growth, STABLE_RATIO),
      change: null,
      versus: growth === null ? 'No earlier period to compare' : `vs previous ${periodWord(a.len)}`,
      spark: null,
    },
  ]
}
