import { mean, clamp, finiteOr } from "../features/util";

/**
 * One month's snapshot of the single feature the forecast needs: the MSME's net
 * inflow for that month. A short series of these (the MSME's transaction history,
 * bucketed by month) is all the projection consumes.
 */
export interface FeatureSnapshot {
  month: string; // "YYYY-MM"
  avgMonthlyNetInflow: number;
}

/** Forward projection of monthly net surplus — matches the Card field exactly. */
export interface Forecast {
  months: string[];
  projected_net_surplus: number[];
}

// Project at least 3 and at most 6 months forward (grows with available history).
const MIN_HORIZON = 3;
const MAX_HORIZON = 6;
// Sanity ceiling: a projection may never exceed 3x the historical average, so a
// steep trend can't diverge into a fantasy number.
const CEILING_MULTIPLE = 3;
// Used only when there is no dated history to anchor the month labels to.
export const DEFAULT_BASE_MONTH = "2024-01";

/** Advance a "YYYY-MM" label by `k` months. */
function shiftMonth(month: string, k: number): string {
  const [y, m] = month.split("-").map(Number);
  const zero = y * 12 + (m - 1) + k;
  const yy = Math.floor(zero / 12);
  const mm = (zero % 12) + 1;
  return `${yy}-${String(mm).padStart(2, "0")}`;
}

/**
 * Simple 3–6 month forward projection of net surplus, by linear-trend
 * extrapolation of the monthly net-inflow series. Deliberately un-clever — this
 * is an explicit "don't over-engineer" item: least-squares slope, extrapolate,
 * then clamp so values stay finite, non-negative, and bounded by 3x the average.
 */
export function forecastScore(
  _msmeId: string,
  historicalFeatureSnapshots: FeatureSnapshot[],
): Forecast {
  const sorted = [...historicalFeatureSnapshots].sort((a, b) =>
    a.month < b.month ? -1 : a.month > b.month ? 1 : 0,
  );
  const series = sorted
    .map((s) => s.avgMonthlyNetInflow)
    .filter((v) => Number.isFinite(v));
  const n = series.length;

  const historicalAvg = mean(series);
  const ceiling = CEILING_MULTIPLE * Math.abs(historicalAvg);

  // Least-squares fit of net inflow against the month index 0..n-1.
  let slope = 0;
  let intercept = historicalAvg;
  if (n >= 2) {
    const xm = (n - 1) / 2;
    let num = 0;
    let den = 0;
    for (let i = 0; i < n; i++) {
      num += (i - xm) * (series[i] - historicalAvg);
      den += (i - xm) * (i - xm);
    }
    slope = den > 0 ? num / den : 0;
    intercept = historicalAvg - slope * xm;
  } else if (n === 1) {
    intercept = series[0];
  }

  const horizon = clamp(n, MIN_HORIZON, MAX_HORIZON);
  const lastMonth = sorted.length
    ? sorted[sorted.length - 1].month
    : DEFAULT_BASE_MONTH;

  const months: string[] = [];
  const projected_net_surplus: number[] = [];
  for (let k = 1; k <= horizon; k++) {
    months.push(shiftMonth(lastMonth, k));
    const raw = intercept + slope * (n - 1 + k);
    projected_net_surplus.push(clamp(finiteOr(raw, 0), 0, ceiling));
  }

  return { months, projected_net_surplus };
}
