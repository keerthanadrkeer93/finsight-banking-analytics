import type { Dataset } from './types.ts'

export interface Range {
  start: number // inclusive, day number
  end: number // inclusive
}
export type Preset = '30d' | '90d' | '12m' | 'all' | 'custom'

export interface Filters {
  preset: Preset
  custom: Range
  regions: string[] // empty array = no restriction
  products: string[]
  segments: string[]
  channels: string[]
}

export const PRESETS: { id: Preset; label: string }[] = [
  { id: '30d', label: '30D' },
  { id: '90d', label: '90D' },
  { id: '12m', label: '12M' },
  { id: 'all', label: 'All' },
  { id: 'custom', label: 'Custom' },
]

export const defaultFilters = (ds: Dataset): Filters => ({
  preset: '12m',
  custom: { start: ds.maxDay - 89, end: ds.maxDay },
  regions: [],
  products: [],
  segments: [],
  channels: [],
})

const PRESET_DAYS = { '30d': 30, '90d': 90, '12m': 365 } as const

/** Presets are anchored to the last day in the data (not today), so they never come back empty. */
export function resolveRange(ds: Dataset, f: Filters): Range {
  if (f.preset === 'all') return { start: ds.minDay, end: ds.maxDay }
  if (f.preset === 'custom') {
    const start = Math.max(ds.minDay, Math.min(f.custom.start, f.custom.end))
    const end = Math.min(ds.maxDay, Math.max(f.custom.start, f.custom.end))
    return { start, end: Math.max(start, end) }
  }
  return { start: Math.max(ds.minDay, ds.maxDay - PRESET_DAYS[f.preset] + 1), end: ds.maxDay }
}

export const activeFilterCount = (f: Filters): number =>
  [f.regions, f.products, f.segments, f.channels].filter((a) => a.length > 0).length
