import type { Takeaway as T } from '../lib/takeaway.ts'

const RULE: Record<T['tone'], string> = {
  up: 'border-good',
  down: 'border-bad',
  flat: 'border-faint',
  info: 'border-accent',
}

/** The page's lead: a plain-language explanation of the most important change, generated from the data. */
export function Takeaway({ takeaway }: { takeaway: T }) {
  return (
    <section aria-live="polite" aria-label="Key takeaway" className={`border-l-[3px] pl-4 sm:pl-6 ${RULE[takeaway.tone]}`}>
      <p className="text-sm font-medium text-muted">Key takeaway</p>
      <h2 className="mt-1 max-w-3xl text-xl font-semibold leading-snug tracking-tight sm:text-2xl">{takeaway.headline}</h2>
      {takeaway.details.length > 0 && (
        <dl className="mt-4 max-w-3xl space-y-2.5">
          {takeaway.details.map((d) => (
            <div key={d.label} className="flex flex-col gap-0.5 text-[15px] leading-relaxed sm:flex-row sm:gap-4">
              <dt className="shrink-0 font-semibold sm:w-24">{d.label}</dt>
              <dd className="text-muted">{d.text}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  )
}
