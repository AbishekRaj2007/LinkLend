import type { TransactionRecord } from "../types";
import { mean, std } from "../features/util";

export interface CashflowForecast {
  /** Historical monthly net inflow, chronological. */
  history: number[];
  /** Projected net inflow for the next 6 months. */
  projected: number[];
  /** Conservative worst-month net surplus across the projection horizon. */
  worstMonthSurplus: number;
}

const HORIZON = 6;

function monthlyNetSeries(txns: TransactionRecord[]): number[] {
  const byMonth = new Map<string, number>();
  for (const t of txns) {
    const m = t.date.slice(0, 7);
    const signed = t.direction === "credit" ? t.amount : -t.amount;
    byMonth.set(m, (byMonth.get(m) ?? 0) + signed);
  }
  return [...byMonth.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, v]) => v);
}

/**
 * Project 6 months of net inflow via a simple linear trend on the historical
 * monthly series, then take a conservative worst-month figure (projected level
 * minus one historical standard deviation) as the amount available to service
 * new debt.
 */
export function forecastCashflow(txns: TransactionRecord[]): CashflowForecast {
  const history = monthlyNetSeries(txns);
  if (history.length === 0) {
    return { history, projected: new Array(HORIZON).fill(0), worstMonthSurplus: 0 };
  }

  const n = history.length;
  const avg = mean(history);
  const volatility = std(history);

  // OLS slope of net inflow vs month index.
  const xbar = (n - 1) / 2;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xbar) * (history[i]! - avg);
    den += (i - xbar) * (i - xbar);
  }
  const slope = den > 1e-9 ? num / den : 0;

  const projected: number[] = [];
  for (let k = 1; k <= HORIZON; k++) {
    projected.push(avg + slope * (n - 1 + k));
  }

  // Worst plausible month: lowest projected level, stressed by one std.
  const worstProjected = Math.min(...projected);
  const worstMonthSurplus = worstProjected - volatility;

  return {
    history,
    projected: projected.map((v) => Math.round(v)),
    worstMonthSurplus: Math.round(worstMonthSurplus),
  };
}
