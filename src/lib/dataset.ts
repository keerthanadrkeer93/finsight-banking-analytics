import { toDay } from './dates.ts'
import type { Dataset, Lookup, Segment, Txn } from './types.ts'

export type Row = Record<string, string>
export interface RawTables {
  customers: Row[]
  transactions: Row[]
  products: Row[]
  regions: Row[]
  channels: Row[]
}

/** Join the five CSV tables once into a single flat array the dashboard can scan quickly. */
export function buildDataset(raw: RawTables): Dataset {
  const customers = new Map(raw.customers.map((c) => [c.customer_id, { regionId: c.region_id, segment: c.segment as Segment }]))

  const txns: Txn[] = []
  for (const r of raw.transactions) {
    const c = customers.get(r.customer_id)
    if (!c) continue // the Python cleaner already removes orphans; this keeps the UI safe regardless
    txns.push({
      day: toDay(r.txn_date),
      customerId: r.customer_id,
      regionId: c.regionId,
      segment: c.segment,
      productId: r.product_id,
      channelId: r.channel_id,
      amount: Number(r.amount),
      fee: Number(r.fee),
      ok: r.status === 'success',
      reason: r.failure_reason,
    })
  }
  txns.sort((a, b) => a.day - b.day)

  const lookup = (rows: Row[], id: string, name: string): Lookup[] => rows.map((r) => ({ id: r[id], name: r[name] }))
  const products = lookup(raw.products, 'product_id', 'product_name')
  const regions = lookup(raw.regions, 'region_id', 'region_name')
  const channels = lookup(raw.channels, 'channel_id', 'channel_name')

  return {
    txns,
    customerCount: customers.size,
    products,
    regions,
    channels,
    names: Object.fromEntries([...products, ...regions, ...channels].map((l) => [l.id, l.name])),
    minDay: txns[0]?.day ?? 0,
    maxDay: txns[txns.length - 1]?.day ?? 0,
  }
}
