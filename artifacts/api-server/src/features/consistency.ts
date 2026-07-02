import type {
  InsertGstReturns,
  InsertTransactions,
  InsertEpfo,
} from "@workspace/db/schema";
import { sum, clamp, safeDiv } from "./util";

export interface ConsistencyFeatures {
  gstToUpiRatio: number;
  epfoHeadcountToPayrollRatio: number;
}

/**
 * Assumed average monthly payroll per EPFO-covered employee. This is the same
 * domain assumption the Gate 1 generator uses; it lets us translate EPFO
 * headcount into an expected payroll outflow.
 */
const ASSUMED_MONTHLY_SALARY = 15000;

// Ratios cap here (keeps them finite/sane); NEUTRAL is used when a corroborating
// source is entirely absent — we cannot detect an inconsistency, so we do not
// fire (the gap is instead recorded in the completeness vector).
const RATIO_CAP = 5;
const NEUTRAL = 1;

/**
 * Cross-source consistency. Both features read as coverage ratios: ~1.0 means the
 * two sources agree, and a LOW value (well below 1) means they disagree — this is
 * how fraud "fires" (GST turnover >> UPI inflows, or EPFO headcount >> payroll).
 */
export function computeConsistency(
  gst: InsertGstReturns[],
  transactions: InsertTransactions[],
  epfo: InsertEpfo[],
): ConsistencyFeatures {
  const totalTurnover = sum(gst.map((g) => g.turnover));
  const totalCredit = sum(
    transactions.filter((t) => t.direction === "credit").map((t) => t.amount),
  );
  const totalPayroll = sum(
    transactions
      .filter((t) => t.direction === "debit" && t.category === "payroll")
      .map((t) => t.amount),
  );
  const totalEmployeeMonths = sum(epfo.map((e) => e.employeeCount));

  // UPI/credit inflows corroborating declared GST turnover.
  const gstToUpiRatio =
    transactions.length === 0 || totalTurnover <= 0
      ? NEUTRAL
      : clamp(safeDiv(totalCredit, totalTurnover, NEUTRAL), 0, RATIO_CAP);

  // Observed payroll outflow vs EPFO-headcount-implied payroll.
  const impliedPayroll = totalEmployeeMonths * ASSUMED_MONTHLY_SALARY;
  const epfoHeadcountToPayrollRatio =
    epfo.length === 0 || transactions.length === 0 || impliedPayroll <= 0
      ? NEUTRAL
      : clamp(safeDiv(totalPayroll, impliedPayroll, NEUTRAL), 0, RATIO_CAP);

  return { gstToUpiRatio, epfoHeadcountToPayrollRatio };
}
