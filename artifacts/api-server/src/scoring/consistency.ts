import type { ConsistencyRatios } from "../features/consistency";

export interface ConsistencyFlag {
  alert: boolean;
  detail: string | null;
}

// Either corroboration ratio dropping below this fires the alert.
const CONSISTENCY_THRESHOLD = 0.5;

/**
 * Plain-language cross-source consistency check — the stand-in for collateral.
 * Not "can we repossess something" but "do this business's own numbers agree
 * with each other." Separate from the score; surfaced to the underwriter.
 */
export function consistencyFlag(ratios: ConsistencyRatios): ConsistencyFlag {
  const problems: string[] = [];
  if (ratios.gstToUpiRatio < CONSISTENCY_THRESHOLD) {
    problems.push(
      `Declared GST turnover is far higher than actual bank inflows (ratio ${ratios.gstToUpiRatio.toFixed(2)}).`,
    );
  }
  if (ratios.epfoHeadcountToPayrollRatio < CONSISTENCY_THRESHOLD) {
    problems.push(
      `EPFO headcount implies more payroll than the bank account pays out (ratio ${ratios.epfoHeadcountToPayrollRatio.toFixed(2)}).`,
    );
  }
  return {
    alert: problems.length > 0,
    detail: problems.length > 0 ? problems.join(" ") : null,
  };
}
