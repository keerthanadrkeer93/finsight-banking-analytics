import { useEffect, useRef, useState, type ReactNode } from 'react'
import { PRESETS, activeFilterCount, type Filters, type Range } from '../../lib/filters.ts'
import { isoDay, toDay } from '../../lib/dates.ts'
import { SEGMENTS, type Dataset, type Lookup } from '../../lib/types.ts'
import { Icon } from '../icons.tsx'

type ListKey = 'regions' | 'products' | 'segments' | 'channels'
const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id])

function MultiSelect({ label, options, value, onChange }: { label: string; options: Lookup[]; value: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const down = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', down)
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key) }
  }, [open])
  const summary = value.length === 0 ? 'All' : value.length === 1 ? (options.find((o) => o.id === value[0])?.name ?? '1 selected') : `${value.length} selected`
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${summary}`}
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex h-10 min-h-10 items-center gap-1.5 rounded-md border px-3 text-sm transition-colors hover:bg-surface ${value.length ? 'border-accent bg-accent-soft' : 'border-line bg-surface'}`}
      >
        <span className="text-muted">{label}</span>
        <span className="max-w-[9rem] truncate font-medium">{summary}</span>
        <Icon name="chevron" className="h-3.5 w-3.5 text-muted" />
      </button>
      {open && (
        <div role="listbox" aria-multiselectable="true" aria-label={label} className="absolute left-0 top-full z-30 mt-1 w-60 rounded-lg border border-line bg-surface p-1 shadow-lg">
          {options.map((o) => {
            const on = value.includes(o.id)
            return (
              <button key={o.id} type="button" role="option" aria-selected={on} aria-label={`${o.name} ${on ? 'selected' : 'not selected'}`} onClick={() => onChange(toggle(value, o.id))} className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm hover:bg-bg">
                <span className={`grid h-4 w-4 place-content-center rounded border ${on ? 'border-accent bg-accent text-white' : 'border-line'}`}>{on && <Icon name="check" className="h-3 w-3" />}</span>
                {o.name}
              </button>
            )
          })}
          {value.length > 0 && <button type="button" onClick={() => onChange([])} className="mt-1 w-full border-t border-line px-2.5 py-2 text-left text-sm text-accent hover:underline">Clear {label.toLowerCase()}</button>}
        </div>
      )}
    </div>
  )
}

function ChipGroup({ label, options, value, onChange }: { label: string; options: Lookup[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <fieldset className="mb-5">
      <legend className="mb-2 text-sm font-semibold">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = value.includes(o.id)
          return (
            <button key={o.id} type="button" aria-pressed={on} aria-label={`${o.name} ${on ? 'selected' : 'not selected'}`} onClick={() => onChange(toggle(value, o.id))} className={`h-10 rounded-full border px-4 text-sm ${on ? 'border-accent bg-accent-soft font-medium text-accent' : 'border-line bg-surface'}`}>
              {o.name}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={`${label} toggle`} onClick={() => onChange(!checked)} className="inline-flex h-10 items-center gap-2 text-sm font-medium">
      <span className={`relative h-5 w-9 rounded-full transition-colors ${checked ? 'bg-accent' : 'bg-faint/60'}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${checked ? 'left-[18px]' : 'left-0.5'}`} />
      </span>
      {label}
    </button>
  )
}

function Sheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="Filters">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 max-h-[85vh] animate-enter overflow-y-auto rounded-t-2xl bg-surface px-5 pb-8 pt-5">{children}</div>
    </div>
  )
}

interface Props {
  ds: Dataset
  filters: Filters
  range: Range
  comparable: boolean
  compare: boolean
  onFilters: (f: Filters) => void
  onCompare: (v: boolean) => void
}

export function FilterBar({ ds, filters, range, comparable, compare, onFilters, onCompare }: Props) {
  const [sheet, setSheet] = useState(false)
  const count = activeFilterCount(filters)
  const set = (patch: Partial<Filters>) => onFilters({ ...filters, ...patch })
  const clear = () => set({ regions: [], products: [], segments: [], channels: [] })
  const groups: { key: ListKey; label: string; options: Lookup[] }[] = [
    { key: 'regions', label: 'Region', options: ds.regions },
    { key: 'products', label: 'Product', options: ds.products },
    { key: 'segments', label: 'Segment', options: SEGMENTS.map((s) => ({ id: s, name: s })) },
    { key: 'channels', label: 'Channel', options: ds.channels },
  ]
  const dateInput = (which: 'start' | 'end', label: string) => (
    <label className="flex items-center gap-2 text-sm text-muted sm:flex-row">
      <span className="shrink-0">{label}</span>
      <input
        type="date"
        value={isoDay(range[which])}
        min={isoDay(ds.minDay)}
        max={isoDay(ds.maxDay)}
        onChange={(e) => e.target.value && set({ preset: 'custom', custom: { ...range, [which]: toDay(e.target.value) } })}
        className="h-10 min-w-0 flex-1 rounded-md border border-line bg-surface px-2 text-sm text-ink"
      />
    </label>
  )

  return (
    <>
      <div className="sticky top-14 z-20 border-b border-line bg-bg/95 backdrop-blur">
        <div className="mx-auto max-w-[1280px] px-4 py-3 sm:px-6">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <div role="group" aria-label="Date range" className="inline-flex w-full flex-wrap gap-1 rounded-md border border-line bg-surface p-0.5 sm:w-auto">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={filters.preset === p.id}
                  aria-label={`${p.label} date preset`}
                  onClick={() => set({ preset: p.id, custom: p.id === 'custom' ? range : filters.custom })}
                  className={`h-9 min-w-[3.75rem] flex-1 rounded px-3 text-sm transition-colors sm:flex-none ${filters.preset === p.id ? 'bg-ink font-medium text-white' : 'text-muted hover:text-ink'}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="hidden items-center gap-2 md:flex">
              {groups.map((g) => <MultiSelect key={g.key} label={g.label} options={g.options} value={filters[g.key]} onChange={(v) => set({ [g.key]: v })} />)}
              {count > 0 && <button type="button" onClick={clear} className="px-1 text-sm text-accent hover:underline">Reset</button>}
            </div>
            <button type="button" aria-label="Open filters" onClick={() => setSheet(true)} className="inline-flex h-10 shrink-0 items-center gap-2 rounded-md border border-line bg-surface px-3 text-sm md:hidden">
              <Icon name="filter" />
              Filters
              {count > 0 && <span className="grid h-5 min-w-5 place-content-center rounded-full bg-accent px-1 text-xs font-medium text-white">{count}</span>}
            </button>
            <div className="ml-auto shrink-0"><Switch checked={compare} onChange={onCompare} label="Compare periods" /></div>
          </div>
          {filters.preset === 'custom' && <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap">{dateInput('start', 'From')}{dateInput('end', 'To')}</div>}
          {compare && !comparable && <p className="mt-2 text-sm text-muted">There is no earlier data to compare this period against.</p>}
        </div>
      </div>

      <Sheet open={sheet} onClose={() => setSheet(false)}>
        <h2 className="mb-4 text-lg font-semibold">Filters</h2>
        {groups.map((g) => <ChipGroup key={g.key} label={g.label} options={g.options} value={filters[g.key]} onChange={(v) => set({ [g.key]: v })} />)}
        <div className="mt-2 flex gap-3">
          <button type="button" onClick={clear} className="h-11 flex-1 rounded-md border border-line text-sm font-medium">Clear all</button>
          <button type="button" onClick={() => setSheet(false)} className="h-11 flex-1 rounded-md bg-accent text-sm font-medium text-white">Show results</button>
        </div>
      </Sheet>
    </>
  )
}
