import type { MsmeBundle } from "../types";
import { mean, safeDiv } from "./util";

/**
 * Cross-source corroboration ratios — the fraud/verification signal that stands
 * in for collateral. ~1.0 means the sources agree; a low value means the
 * business's self-declared numbers disagree with what its bank account shows.
 */
export interface ConsistencyRatios {
  /** Bank inflow vs declared GST turnover. Low => turnover inflated on paper. */
  gstToUpiRatio: number;
  /** Bank payroll outflow vs payroll implied by EPFO headcount. Low => ghost heads. */
  epfoHeadcountToPayrollRatio: number;
}

// Rough all-India assumption for "what one EPFO-covered employee costs per month"
// used only to translate headcount into an expected payroll outflow.
const ASSUMED_MONTHLY_WAGE = 18000;

export function computeConsistency(bundle: MsmeBundle): ConsistencyRatios {
  // --- gstToUpiRatio -------------------------------------------------------
  const gstMonths = bundle.gst.length;
  const avgGstTurnover = gstMonths > 0 ? mean(bundle.gst.map((g) => g.turnover)) : 0;

  const creditByMonth = new Map<string, number>();
  for (const t of bundle.transactions) {
    if (t.direction !== "credit") continue;
    const m = t.date.slice(0, 7);
    creditByMonth.set(m, (creditByMonth.get(m) ?? 0) + t.amount);
  }
  const avgBankInflow =
    creditByMonth.size > 0 ? mean([...creditByMonth.values()]) : 0;

  const gstToUpiRatio =
    gstMonths > 0 && creditByMonth.size > 0
      ? safeDiv(avgBankInflow, avgGstTurnover, 1)
      : 1; // no basis to compare -> treat as corroborated (neutral)

  // --- epfoHeadcountToPayrollRatio ----------------------------------------
  const epfoMonths = bundle.epfo.length;
  const avgHeadcount =
    epfoMonths > 0 ? mean(bundle.epfo.map((e) => e.employeeCount)) : 0;

  const payrollByMonth = new Map<string, number>();
  for (const t of bundle.transactions) {
    if (t.direction !== "debit") continue;
    if (t.category !== "payroll") continue;
    const m = t.date.slice(0, 7);
    payrollByMonth.set(m, (payrollByMonth.get(m) ?? 0) + t.amount);
  }
  const avgPayrollPaid =
    payrollByMonth.size > 0 ? mean([...payrollByMonth.values()]) : 0;
  const impliedPayroll = avgHeadcount * ASSUMED_MONTHLY_WAGE;

  const epfoHeadcountToPayrollRatio =
    epfoMonths > 0 && payrollByMonth.size > 0 && impliedPayroll > 0
      ? safeDiv(avgPayrollPaid, impliedPayroll, 1)
      : 1;

  return {
    gstToUpiRatio: Number(gstToUpiRatio.toFixed(4)),
    epfoHeadcountToPayrollRatio: Number(epfoHeadcountToPayrollRatio.toFixed(4)),
  };
}
