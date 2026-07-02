import type { InsertGstReturns, InsertEpfo } from "@workspace/db/schema";
import { clamp, safeDiv, monthSpan } from "./util";

export interface ComplianceFeatures {
  gstOnTimeFilingPct: number;
  monthsFiledOverMonthsActive: number;
  epfoActiveFlag: number;
  epfoContributionConsistency: number;
}

/** Formalisation & Compliance — GST filing discipline and EPFO footprint. */
export function computeCompliance(
  gst: InsertGstReturns[],
  epfo: InsertEpfo[],
): ComplianceFeatures {
  const total = gst.length;
  const onTime = gst.filter(
    (g) => g.filingDate != null && g.filingDate <= g.dueDate,
  ).length;
  const gstOnTimeFilingPct = total ? clamp(onTime / total, 0, 1) : 0;

  let monthsFiledOverMonthsActive = 0;
  if (total > 0) {
    const periods = gst.map((g) => g.period).sort();
    const span = monthSpan(periods[0], periods[periods.length - 1]);
    const filed = gst.filter((g) => g.filingDate != null).length;
    monthsFiledOverMonthsActive = clamp(safeDiv(filed, span, 0), 0, 1);
  }

  const epfoActiveFlag = epfo.length > 0 ? 1 : 0;
  const epfoContributionConsistency = epfo.length
    ? clamp(epfo.filter((e) => e.paidOnTime).length / epfo.length, 0, 1)
    : 0;

  return {
    gstOnTimeFilingPct,
    monthsFiledOverMonthsActive,
    epfoActiveFlag,
    epfoContributionConsistency,
  };
}
