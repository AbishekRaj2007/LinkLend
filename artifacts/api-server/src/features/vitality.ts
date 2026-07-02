import type { InsertGstReturns } from "@workspace/db/schema";
import { mean, cv, trendRatio, safeDiv, clamp, finiteOr } from "./util";

export interface VitalityFeatures {
  turnover6moTrend: number;
  turnoverCAGR: number;
  turnoverVolatilityCV: number;
  invoiceCountTrend: number;
  seasonalityIndex: number;
}

/** Business Vitality — turnover growth, stability, and seasonality from GST. */
export function computeVitality(gst: InsertGstReturns[]): VitalityFeatures {
  const sorted = [...gst].sort((a, b) =>
    a.period < b.period ? -1 : a.period > b.period ? 1 : 0,
  );
  const turnovers = sorted.map((g) => g.turnover);
  const invoices = sorted.map((g) => g.invoiceCount);

  const turnover6moTrend = trendRatio(turnovers.slice(-6));
  const invoiceCountTrend = trendRatio(invoices);
  const turnoverVolatilityCV = cv(turnovers);

  let turnoverCAGR = 0;
  if (turnovers.length >= 2) {
    const first = turnovers[0];
    const last = turnovers[turnovers.length - 1];
    if (first > 0 && last > 0) {
      const periods = turnovers.length - 1; // month-to-month steps
      turnoverCAGR = clamp(
        finiteOr(Math.pow(last / first, 12 / periods) - 1, 0),
        -1,
        10,
      );
    }
  }

  let seasonalityIndex = 0;
  if (turnovers.length >= 2) {
    const mx = Math.max(...turnovers);
    const mn = Math.min(...turnovers);
    seasonalityIndex = clamp(safeDiv(mx - mn, mean(turnovers), 0), 0, 10);
  }

  return {
    turnover6moTrend,
    turnoverCAGR,
    turnoverVolatilityCV,
    invoiceCountTrend,
    seasonalityIndex,
  };
}
