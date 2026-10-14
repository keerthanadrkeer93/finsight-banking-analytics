import type { ReactNode } from 'react'

export function ChartCard({ title, subtitle, children, className = '' }: { title: string; subtitle?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`min-w-0 rounded-lg border border-line bg-surface p-4 shadow-card sm:p-5 ${className}`}>
      <header className="mb-4">
        <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </header>
      {children}
    </section>
  )
}
