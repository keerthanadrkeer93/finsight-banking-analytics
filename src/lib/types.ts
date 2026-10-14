export type Segment = 'Premium' | 'High Value' | 'Standard'
export const SEGMENTS: Segment[] = ['Premium', 'High Value', 'Standard']

export interface Lookup {
  id: string
  name: string
}

/** One transaction attempt, already joined to its customer's region and segment. */
export interface Txn {
  day: number // whole days since 1970-01-01 (UTC), so date maths is plain integer maths
  customerId: string
  regionId: string
  segment: Segment
  productId: string
  channelId: string
  amount: number
  fee: number
  ok: boolean
  reason: string
}

export interface Dataset {
  txns: Txn[]
  customerCount: number
  products: Lookup[]
  regions: Lookup[]
  channels: Lookup[]
  names: Record<string, string> // id -> display name, for every lookup table
  minDay: number
  maxDay: number
}
