import { useState } from 'react'
import { Icon } from '../icons.tsx'

const NAV = [
  { label: 'Overview', current: true },
  { label: 'Customers', current: false },
  { label: 'Transactions', current: false },
  { label: 'Insights', current: false },
]

function Item({ label, current }: { label: string; current: boolean }) {
  return current ? (
    <a href="#/" aria-current="page" className="rounded-md bg-accent-soft px-3 py-1.5 text-sm font-medium text-accent">{label}</a>
  ) : (
    <span aria-disabled="true" className="rounded-md px-3 py-1.5 text-sm text-faint">
      {label} <span className="ml-1 text-xs">soon</span>
    </span>
  )
}

export function Header({ asOf }: { asOf?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1280px] items-center gap-6 px-4 sm:px-6">
        <a href="#/" className="flex items-center gap-2.5" aria-label="FinSight home">
          <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden="true">
            <rect width="32" height="32" rx="7" fill="#0b5f7a" />
            <path d="M8 22V14M14 22V9M20 22v-6M26 22V12" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
          </svg>
          <span className="text-[17px] font-semibold tracking-tight">FinSight</span>
        </a>
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {NAV.map((n) => <Item key={n.label} {...n} />)}
        </nav>
        {asOf && <p className="ml-auto hidden text-sm text-muted sm:block">Data as of {asOf}</p>}
        <button
          type="button"
          className="ml-auto grid h-10 w-10 place-content-center rounded-md text-ink hover:bg-bg sm:ml-4 md:hidden"
          aria-expanded={open}
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((o) => !o)}
        >
          <Icon name={open ? 'x' : 'menu'} className="h-5 w-5" />
        </button>
      </div>
      {open && (
        <nav className="flex flex-col gap-1 border-t border-line px-4 py-3 md:hidden" aria-label="Main">
          {NAV.map((n) => <Item key={n.label} {...n} />)}
          {asOf && <p className="px-3 pt-2 text-sm text-muted">Data as of {asOf}</p>}
        </nav>
      )}
    </header>
  )
}
