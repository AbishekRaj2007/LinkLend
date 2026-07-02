import type { InsertObligations } from "@workspace/db/schema";
import { clamp, safeDiv } from "./util";

export interface ObligationFeatures {
  obligationToInflowRatio: number;
  obligationCount: number;
}

const RATIO_CAP = 50;

/**
 * Obligations & Leverage — monthly obligation relative to inflow, and EMI count.
 * `avgMonthlyInflow` is the mean monthly credit inflow (passed in so transaction
 * grouping happens once, in the caller).
 */
export function computeObligations(
  obligations: InsertObligations[],
  avgMonthlyInflow: number,
): ObligationFeatures {
  const monthlyObligation = obligations.length ? obligations[0].monthlyObligation : 0;
  const obligationCount = obligations.length ? obligations[0].existingEmis : 0;

  // High leverage (or unobservable inflow with obligations present) → capped high.
  const obligationToInflowRatio = clamp(
    safeDiv(monthlyObligation, avgMonthlyInflow, monthlyObligation > 0 ? RATIO_CAP : 0),
    0,
    RATIO_CAP,
  );

  return { obligationToInflowRatio, obligationCount };
}
