const MS = 86_400_000
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** 'YYYY-MM-DD' -> whole days since epoch (UTC). */
export const toDay = (iso: string): number => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return Date.UTC(y, m - 1, d) / MS
}
const fromDay = (day: number) => new Date(day * MS)
export const isoDay = (day: number): string => fromDay(day).toISOString().slice(0, 10)

/** '5 Mar' */
export const fmtShort = (day: number): string => {
  const d = fromDay(day)
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`
}
/** '5 Mar 2026' */
export const fmtDate = (day: number): string => `${fmtShort(day)} ${fromDay(day).getUTCFullYear()}`

export const monthIndex = (day: number): number => {
  const d = fromDay(day)
  return d.getUTCFullYear() * 12 + d.getUTCMonth()
}
/** Month index -> "Oct ’25" */
export const monthLabel = (idx: number): string =>
  `${MONTHS[idx % 12]} ’${String(Math.floor(idx / 12) % 100).padStart(2, '0')}`
