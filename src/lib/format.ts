const IN = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 })

export const num = (n: number): string => IN.format(Math.round(n))

/** Indian compact currency: ₹4.68 L, ₹1.20 Cr, or ₹4,712 below a lakh. */
export function inr(n: number): string {
  const a = Math.abs(n)
  const s = n < 0 ? '−' : ''
  if (a >= 1e7) return `${s}₹${(a / 1e7).toFixed(2)} Cr`
  if (a >= 1e5) return `${s}₹${(a / 1e5).toFixed(2)} L`
  return `${s}₹${IN.format(Math.round(a))}`
}
export const inrFull = (n: number): string => `₹${IN.format(Math.round(n))}`
export const axisInr = (n: number): string =>
  n >= 1e5 ? `${+(n / 1e5).toFixed(1)}L` : n >= 1e3 ? `${+(n / 1e3).toFixed(0)}K` : String(n)

export const pct = (x: number, digits = 1): string => `${(x * 100).toFixed(digits)}%`
export const signedPct = (x: number, digits = 1): string => `${x >= 0 ? '+' : '−'}${Math.abs(x * 100).toFixed(digits)}%`
export const signedInr = (n: number): string => `${n >= 0 ? '+' : '−'}${inr(Math.abs(n))}`
/** Percentage-point change, e.g. +0.4 pp */
export const pp = (x: number): string => `${x >= 0 ? '+' : '−'}${Math.abs(x * 100).toFixed(1)} pp`
