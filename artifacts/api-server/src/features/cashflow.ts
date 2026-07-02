import type { InsertTransactions, InsertObligations } from "@workspace/db/schema";
import { mean, cv, safeDiv, clamp, finiteOr, monthlyCashflow } from "./util";

export interface CashflowFeatures {
  avgMonthlyNetInflow: number;
  inflowVolatilityCV: number;
  runwayMonths: number;
  negativeBalanceDays: number;
  dscrProxy: number;
}

// A firm that is not burning cash has effectively unbounded runway; cap it so
// the feature stays finite and comparable.
const RUNWAY_CAP = 60;

/** Cashflow Health — net inflow, volatility, runway, and debt-service proxy. */
export function computeCashflow(
  transactions: InsertTransactions[],
  obligations: InsertObligations[],
): CashflowFeatures {
  const { credit, net } = monthlyCashflow(transactions);

  const avgMonthlyNetInflow = mean(net);
  const inflowVolatilityCV = cv(credit);

  // Latest running balance (chronologically last transaction).
  const sorted = [...transactions].sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : 0,
  );
  const balance = sorted.length ? sorted[sorted.length - 1].runningBalance : 0;

  const burn = Math.max(0, -avgMonthlyNetInflow);
  const runwayMonths =
    burn > 1e-9 ? clamp(safeDiv(balance, burn, RUNWAY_CAP), 0, RUNWAY_CAP) : RUNWAY_CAP;

  const negativeBalanceDays = transactions.filter(
    (t) => t.runningBalance < 0,
  ).length;

  const monthlyObligation = obligations.length ? obligations[0].monthlyObligation : 0;
  // DSCR proxy: serviceable income over monthly obligation. Non-negative
  // (income floored at 0 for distressed firms); 0 when no obligation on record.
  const dscrProxy = clamp(
    safeDiv(Math.max(0, avgMonthlyNetInflow), monthlyObligation, 0),
    0,
    100,
  );

  return {
    avgMonthlyNetInflow: finiteOr(avgMonthlyNetInflow, 0),
    inflowVolatilityCV,
    runwayMonths: finiteOr(runwayMonths, RUNWAY_CAP),
    negativeBalanceDays,
    dscrProxy,
  };
}
