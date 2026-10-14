import { Area, AreaChart, ResponsiveContainer, YAxis } from 'recharts'

export function Sparkline({ data }: { data: number[] }) {
  const rows = data.map((v, i) => ({ i, v }))
  return (
    <div className="h-9 w-full" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={{ top: 3, right: 0, bottom: 0, left: 0 }}>
          <YAxis hide domain={['dataMin', 'dataMax']} />
          <Area type="monotone" dataKey="v" stroke="#0b5f7a" strokeWidth={1.5} fill="#0b5f7a" fillOpacity={0.08} dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
