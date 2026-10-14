import { Area, Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartTip } from './ChartTip.tsx'

export interface TrendRow {
  label: string
  cur: number
  prev?: number
}
interface Props {
  data: TrendRow[]
  kind: 'area' | 'bar'
  format: (n: number) => string
  axis: (n: number) => string
  compare: boolean
}
const TICK = { fontSize: 12, fill: '#566474' }

export function TrendChart({ data, kind, format, axis, compare }: Props) {
  const showPrev = compare && data.some((d) => d.prev !== undefined)
  return (
    <div className="h-64 w-full sm:h-72">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -6 }}>
          <CartesianGrid vertical={false} stroke="#e8ecef" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={TICK} interval="preserveStartEnd" minTickGap={12} tickMargin={6} />
          <YAxis tickLine={false} axisLine={false} width={44} tick={TICK} tickFormatter={axis} />
          <Tooltip content={<ChartTip format={format} />} cursor={kind === 'bar' ? { fill: '#eef2f4' } : { stroke: '#c4ccd4' }} />
          {kind === 'area' ? (
            <Area type="monotone" dataKey="cur" name="This period" stroke="#0b5f7a" strokeWidth={2} fill="#0b5f7a" fillOpacity={0.08} dot={data.length < 4} animationDuration={500} />
          ) : (
            <Bar dataKey="cur" name="This period" fill="#0b5f7a" radius={[3, 3, 0, 0]} maxBarSize={36} animationDuration={500} />
          )}
          {showPrev && <Line type="monotone" dataKey="prev" name="Previous period" stroke="#8592a1" strokeWidth={1.5} strokeDasharray="4 4" dot={false} animationDuration={500} />}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
