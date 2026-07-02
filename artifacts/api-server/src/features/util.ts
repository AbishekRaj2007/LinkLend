import type { InsertTransactions } from "@workspace/db/schema";

/** Sum, tolerant of an empty array. */
export function sum(xs: number[]): number {
  let s = 0;
  for (const x of xs) s += x;
  return s;
}

/** Arithmetic mean; 0 for an empty array. */
export function mean(xs: number[]): number {
  return xs.length === 0 ? 0 : sum(xs) / xs.length;
}

/** Population standard deviation; 0 when fewer than 2 samples. */
export function std(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  let acc = 0;
  for (const x of xs) acc += (x - m) * (x - m);
  return Math.sqrt(acc / xs.length);
}

/**
 * Coefficient of variation (std / |mean|). Always finite and non-negative:
 * returns 0 when the mean is ~0 or there are too few samples, and is capped
 * so a near-zero mean can never produce a runaway value.
 */
export function cv(xs: number[]): number {
  if (xs.length < 2) return 0;
  const denom = Math.abs(mean(xs));
  if (denom < 1e-9) return 0;
  const v = std(xs) / denom;
  return Number.isFinite(v) ? clamp(v, 0, 10) : 0;
}

/** Division that never yields NaN/Infinity — returns `fallback` on divide-by-~0. */
export function safeDiv(a: number, b: number, fallback = 0): number {
  if (!Number.isFinite(a) || !Number.isFinite(b) || Math.abs(b) < 1e-12) {
    return fallback;
  }
  const r = a / b;
  return Number.isFinite(r) ? r : fallback;
}

export function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

export function finiteOr(x: number, fallback = 0): number {
  return Number.isFinite(x) ? x : fallback;
}

/**
 * Fractional trend of a chronological series: (mean of later half − mean of
 * earlier half) / |mean of earlier half|. Negative = declining. Clamped so it
 * stays finite even when the early period is ~0.
 */
export function trendRatio(values: number[]): number {
  if (values.length < 2) return 0;
  const half = Math.floor(values.length / 2);
  const first = values.slice(0, half);
  const second = values.slice(values.length - half);
  const fm = mean(first);
  const r = safeDiv(mean(second) - fm, Math.abs(fm), 0);
  return clamp(finiteOr(r, 0), -10, 10);
}

/** Inclusive month count between two "YYYY-MM" periods (>= 1). */
export function monthSpan(a: string, b: string): number {
  const [ay, am] = a.split("-").map(Number);
  const [by, bm] = b.split("-").map(Number);
  return (by - ay) * 12 + (bm - am) + 1;
}

/**
 * Monthly credit/debit totals, in chronological order. Used by the cashflow and
 * obligations pillars so transaction grouping lives in exactly one place.
 */
export function monthlyCashflow(transactions: InsertTransactions[]): {
  credit: number[];
  debit: number[];
  net: number[];
} {
  const sorted = [...transactions].sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : 0,
  );
  const byMonth = new Map<string, { credit: number; debit: number }>();
  for (const t of sorted) {
    const m = t.date.slice(0, 7);
    const e = byMonth.get(m) ?? { credit: 0, debit: 0 };
    if (t.direction === "credit") e.credit += t.amount;
    else e.debit += t.amount;
    byMonth.set(m, e);
  }
  const credit: number[] = [];
  const debit: number[] = [];
  const net: number[] = [];
  for (const e of byMonth.values()) {
    credit.push(e.credit);
    debit.push(e.debit);
    net.push(e.credit - e.debit);
  }
  return { credit, debit, net };
}
