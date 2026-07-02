import type { FeatureRecord } from "../features";

export interface RepaymentResult {
  sustainableEmi: number;
  basis: string;
}

/**
 * Fraction of the projected worst-month surplus we treat as safely available for
 * a new EMI. k = 0.4 leaves a ~2.5x buffer between sustainable surplus and the
 * committed EMI — deliberately conservative for thin-file / volatile MSMEs.
 */
const K = 0.4;

/**
 * Estimate a sustainable new EMI from cashflow features.
 *
 * projectedMinMonthlyNetSurplus ≈ mean − 1 stdev of monthly net inflow, floored
 * at 0. We only have the CV of inflows, so stdev ≈ CV * mean; the (1 − CV) haircut
 * is a simple seasonal/volatility adjustment that penalises erratic cashflows.
 */
export function sustainableEmi(f: FeatureRecord): RepaymentResult {
  const meanInflow = Math.max(0, f.avgMonthlyNetInflow);
  const vol = Math.max(0, f.inflowVolatilityCV);
  const projectedMinMonthlyNetSurplus = Math.max(0, meanInflow * (1 - vol));
  const emi = Math.round(K * projectedMinMonthlyNetSurplus);

  return {
    sustainableEmi: emi,
    basis:
      `${Math.round(K * 100)}% of projected worst-month net surplus ` +
      `(avg monthly net inflow haircut for cashflow volatility, floored at 0)`,
  };
}
