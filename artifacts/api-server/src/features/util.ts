// Small numeric helpers shared across feature computations. All are total
// (never throw, never return NaN/Infinity) so thin-file inputs degrade to finite
// values rather than propagating garbage into the models.

export function clamp(x: number, lo: number, hi: number): number {
  if (Number.isNaN(x)) return lo;
  return Math.min(hi, Math.max(lo, x));
}

/** a / b with a guarded denominator; returns `fallback` when b ~ 0. */
export function safeDiv(a: number, b: number, fallback = 0): number {
  if (!(Math.abs(b) > 1e-9)) return fallback;
  const r = a / b;
  return Number.isFinite(r) ? r : fallback;
}

export function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

export function std(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  const v = xs.reduce((s, x) => s + (x - m) * (x - m), 0) / xs.length;
  return Math.sqrt(v);
}

/** Coefficient of variation = std / |mean|, non-negative, capped for finiteness. */
export function cv(xs: number[], cap = 3): number {
  const m = mean(xs);
  if (!(Math.abs(m) > 1e-9)) return 0;
  return clamp(std(xs) / Math.abs(m), 0, cap);
}

/**
 * Ordinary-least-squares slope of `ys` against index 0..n-1, expressed relative
 * to the series mean so it is scale-free (a "% per period" trend). Clamped.
 */
export function relativeSlope(ys: number[], cap = 1): number {
  const n = ys.length;
  if (n < 2) return 0;
  const xbar = (n - 1) / 2;
  const ybar = mean(ys);
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xbar) * (ys[i]! - ybar);
    den += (i - xbar) * (i - xbar);
  }
  const slope = safeDiv(num, den, 0);
  return clamp(safeDiv(slope, Math.abs(ybar), 0), -cap, cap);
}

/** Compound growth rate from first to last value over the series length. */
export function cagr(ys: number[], cap = 2): number {
  const n = ys.length;
  if (n < 2) return 0;
  const first = ys[0]!;
  const last = ys[n - 1]!;
  if (!(first > 1e-9) || !(last > 1e-9)) return 0;
  const periods = n - 1;
  const r = Math.pow(last / first, 1 / periods) - 1;
  return clamp(r, -cap, cap);
}

/** Parse "YYYY-MM" or "YYYY-MM-DD" into a comparable [year, month] pair. */
export function monthOf(period: string): { year: number; month: number } {
  const [y, m] = period.split("-");
  return { year: Number(y) || 0, month: Number(m) || 0 };
}

/** Chronological key for sorting "YYYY-MM" strings. */
export function periodKey(period: string): number {
  const { year, month } = monthOf(period);
  return year * 12 + month;
}
