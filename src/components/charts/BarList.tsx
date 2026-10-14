import { signedPct } from '../../lib/format.ts'

export interface BarRow {
  id: string
  name: string
  value: number
  share: number
  change?: number | null // vs previous period; undefined hides the chip
}
interface Props {
  rows: BarRow[]
  selected: string[]
  onSelect: (id: string) => void
  format: (n: number) => string
}

/** Ranked horizontal bars. Each row is a button: clicking it filters the whole dashboard to that item. */
export function BarList({ rows, selected, onSelect, format }: Props) {
  const max = Math.max(...rows.map((r) => r.value), 1)
  return (
    <ul className="space-y-1">
      {rows.map((r) => {
        const on = selected.includes(r.id)
        const chip = r.change === undefined || r.change === null ? null : Math.abs(r.change) < 0.01 ? 'text-muted' : r.change > 0 ? 'text-good' : 'text-bad'
        return (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => onSelect(r.id)}
              aria-pressed={on}
              className={`block w-full min-w-0 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-bg ${on ? 'bg-accent-soft' : ''}`}
            >
              <span className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-baseline gap-2 text-sm">
                <span className="min-w-0 truncate font-medium text-ink">{r.name}</span>
                {chip && <span className={`text-xs tabular-nums ${chip}`}>{signedPct(r.change as number, 0)}</span>}
                <span className="w-16 text-right tabular-nums text-ink">{format(r.value)}</span>
                <span className="hidden w-10 text-right text-xs tabular-nums text-muted sm:block">{(r.share * 100).toFixed(0)}%</span>
              </span>
              <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-bg">
                <span className="block h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${(r.value / max) * 100}%` }} />
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
