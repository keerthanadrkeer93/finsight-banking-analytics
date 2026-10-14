import type { Analysis, Breakdown, PeriodStats } from './analytics.ts'
import { periodWord, ratioChange, STABLE_RATE, STABLE_RATIO } from './kpis.ts'
import type { Filters } from './filters.ts'
import { inr, num, pct, signedInr, signedPct } from './format.ts'

export interface Takeaway {
  tone: 'up' | 'down' | 'flat' | 'info'
  headline: string
  details: { label: string; text: string }[]
}

const MIN_TXNS = 30 // below this a selection is too thin to say anything
const MIN_CHANNEL_TXNS = 150 // minimum attempts per channel and period before a failure-rate move counts

interface Mover {
  dim: 'product' | 'region' | 'segment'
  label: string
  delta: number
  change: number | null
}

/** Revenue movement of every product, region and customer segment between the two periods. */
function movers(cur: PeriodStats, prev: PeriodStats, f: Filters): Mover[] {
  // A dimension filtered down to one member explains nothing ("Premium drove the Premium change"), so skip it.
  const dims = [
    ['product', cur.byProduct, prev.byProduct, f.products.length === 1],
    ['region', cur.byRegion, prev.byRegion, f.regions.length === 1],
    ['segment', cur.bySegment, prev.bySegment, f.segments.length === 1],
  ] as const
  const out: Mover[] = []
  for (const [dim, now, before, pinned] of dims) {
    if (pinned) continue
    for (const row of now) {
      const was = before.find((b) => b.id === row.id)?.revenue ?? 0
      out.push({
        dim,
        label: dim === 'region' ? `${row.name} region` : dim === 'segment' ? `${row.name} customers` : row.name,
        delta: row.revenue - was,
        change: was > 0 ? row.revenue / was - 1 : null,
      })
    }
  }
  return out
}

const failRate = (b: Breakdown) => (b.txns ? b.failed / b.txns : 0)
const withChange = (m: Mover) => `${signedInr(m.delta)}${m.change === null ? '' : `, ${signedPct(m.change)}`}`
const failureTail = (b: { before: number; now: number }) => `from ${pct(b.before)} to ${pct(b.now)}`

/** The channel whose failure rate rose the most, using only channels with enough volume in both periods. */
function worstChannel(cur: PeriodStats, prev: PeriodStats) {
  let best: { id: string; name: string; before: number; now: number } | null = null
  for (const c of cur.byChannel) {
    const p = prev.byChannel.find((x) => x.id === c.id)
    if (!p || c.txns < MIN_CHANNEL_TXNS || p.txns < MIN_CHANNEL_TXNS) continue
    const rise = failRate(c) - failRate(p)
    if (!best || rise > best.now - best.before) best = { id: c.id, name: c.name, before: failRate(p), now: failRate(c) }
  }
  return best
}

function topReasonClause(cur: PeriodStats, channelId: string): string {
  const reasons = cur.channelReasons[channelId] ?? []
  const total = reasons.reduce((s, r) => s + r.count, 0)
  const top = reasons[0]
  return top && total && top.count / total >= 0.4 ? `. ${top.reason} makes up ${pct(top.count / total, 0)} of its failures` : ''
}

/** Used when there is no earlier period to compare against: describe, don't explain change. */
function describe(a: Analysis): Takeaway {
  const { cur } = a
  const details: Takeaway['details'] = []

  const totalRev = cur.summary.revenue
  const totalCust = cur.bySegment.reduce((s, b) => s + b.active, 0)
  const lead = cur.bySegment
    .filter((b) => b.active >= 30 && totalRev > 0)
    .map((b) => ({ b, ratio: b.revenue / totalRev / (b.active / totalCust) }))
    .sort((x, y) => y.ratio - x.ratio)[0]
  if (lead) {
    details.push({
      label: 'Concentration',
      text: `${lead.b.name} customers are ${pct(lead.b.active / totalCust, 0)} of active customers but generate ${pct(lead.b.revenue / totalRev, 0)} of revenue.`,
    })
  }
  const weakest = [...cur.byChannel].filter((c) => c.txns >= MIN_CHANNEL_TXNS).sort((x, y) => failRate(y) - failRate(x))[0]
  if (weakest) {
    details.push({
      label: 'Reliability',
      text: `${weakest.name} has the highest failure rate at ${pct(failRate(weakest))}${topReasonClause(cur, weakest.id)}.`,
    })
  }
  return {
    tone: 'info',
    headline: `${inr(cur.summary.revenue)} revenue from ${num(cur.summary.txns)} transactions in the selected period. There is no earlier period to compare against.`,
    details,
  }
}

export function buildTakeaway(a: Analysis, f: Filters): Takeaway {
  const { cur, prev } = a
  if (cur.summary.txns < MIN_TXNS) {
    return {
      tone: 'info',
      headline: 'There is too little data in this selection to draw a reliable conclusion.',
      details: [{ label: 'Try', text: 'Widen the date range or clear a filter.' }],
    }
  }
  if (!prev || prev.summary.txns < MIN_TXNS || prev.summary.revenue <= 0) return describe(a)

  const change = ratioChange(cur.summary.revenue, prev.summary.revenue) ?? 0
  const total = cur.summary.revenue - prev.summary.revenue
  const dir = total >= 0 ? 1 : -1
  const tone: Takeaway['tone'] = Math.abs(change) < STABLE_RATIO ? 'flat' : change > 0 ? 'up' : 'down'
  const versus = `previous ${periodWord(a.len)}`
  const headline =
    tone === 'flat'
      ? `Revenue was broadly flat at ${inr(cur.summary.revenue)} (${signedPct(change)}) compared with the ${versus}.`
      : `Revenue ${tone === 'up' ? 'rose' : 'fell'} ${pct(Math.abs(change))} to ${inr(cur.summary.revenue)} compared with the ${versus}.`

  const all = movers(cur, prev, f)
  const details: Takeaway['details'] = []

  // Driver: what explains the movement in revenue
  if (tone === 'flat') {
    const gain = [...all].sort((x, y) => y.delta - x.delta)[0]
    const loss = [...all].sort((x, y) => x.delta - y.delta)[0]
    if (gain && loss && gain.delta > 0 && loss.delta < 0 && Math.min(gain.delta, -loss.delta) >= 0.05 * cur.summary.revenue) {
      details.push({ label: 'Driver', text: `Gains in ${gain.label} (${withChange(gain)}) were offset by ${loss.label} (${withChange(loss)}).` })
    }
  } else {
    const ranked = all.filter((m) => m.delta * dir > 0).sort((x, y) => y.delta * dir - x.delta * dir)
    const first = ranked[0]
    if (first) {
      const share = first.delta / total
      const second = ranked.find((m) => m.dim !== first.dim && m.delta / total >= 0.2)
      const noun = total > 0 ? 'increase' : 'decrease'
      let text = `Biggest driver: ${first.label} (${withChange(first)}), ${share > 1 ? `more than the whole net ${noun}` : `${Math.round(share * 100)}% of the net ${noun}`}.`
      if (second) text += ` ${second.label} ${total > 0 ? 'added' : 'removed'} a further ${inr(Math.abs(second.delta))}.`
      details.push({ label: 'Driver', text })
    }
  }

  // Watch-out: a reliability problem beats an opposing mover. Checked per channel too, because a
  // sharp rise in one channel can hide inside a steady overall success rate.
  const srChange = cur.summary.successRate - prev.summary.successRate
  const ch = worstChannel(cur, prev)
  const channelRise = ch ? ch.now - ch.before : 0
  if (srChange <= -STABLE_RATE || channelRise >= 0.01) {
    const reason = ch ? topReasonClause(cur, ch.id) : ''
    const text =
      srChange <= -STABLE_RATE
        ? `Success rate slipped from ${pct(prev.summary.successRate)} to ${pct(cur.summary.successRate)}${ch && channelRise > 0 ? `, driven by ${ch.name}, where failures rose ${failureTail(ch)}${reason}` : ''}.`
        : `Success rate held near ${pct(cur.summary.successRate)} overall, but ${ch?.name} failures rose ${ch ? failureTail(ch) : ''}${reason}.`
    details.push({ label: 'Watch-out', text })
  } else {
    const against = all.filter((m) => m.delta * dir < 0).sort((x, y) => x.delta * dir - y.delta * dir)[0]
    if (against && Math.abs(against.delta) >= 0.1 * Math.abs(total) && (against.change === null || Math.abs(against.change) >= 0.05)) {
      details.push({ label: tone === 'down' ? 'Bright spot' : 'Watch-out', text: `${against.label} moved against the trend (${withChange(against)}).` })
    }
  }

  return { tone, headline, details }
}
