interface Entry {
  name?: string | number
  value?: number | string
  color?: string
}
interface Props {
  active?: boolean
  payload?: Entry[]
  label?: string | number
  format: (n: number) => string
}

export function ChartTip({ active, payload, label, format }: Props) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-md border border-line bg-surface px-3 py-2 text-sm shadow-lg">
      <p className="mb-1 font-medium text-ink">{label}</p>
      {payload.map((e) => (
        <p key={String(e.name)} className="flex items-center gap-2 text-muted">
          <span className="h-2 w-2 rounded-full" style={{ background: e.color }} />
          {e.name}
          <span className="ml-auto pl-4 font-medium tabular-nums text-ink">{format(Number(e.value))}</span>
        </p>
      ))}
    </div>
  )
}
