import type { TransactionRecord } from "../types";
import { forecastCashflow, type CashflowForecast } from "./forecast";

export interface RepaymentCapacity {
  forecast: CashflowForecast;
  /** Suggested sustainable monthly EMI, grounded in projected cashflow. */
  sustainableEmi: number;
}

// Fraction of the projected worst-month surplus we treat as safely committable
// to a new EMI. Deliberately conservative.
const EMI_FRACTION = 0.4;

/**
 * Sustainable EMI = 40% of the projected worst-month net surplus (floored at 0).
 * The figure comes from what the business's own bank account can afford, not
 * from a collateral resale valuation.
 */
export function sustainableEmi(txns: TransactionRecord[]): RepaymentCapacity {
  const forecast = forecastCashflow(txns);
  const emi = Math.max(0, Math.round(forecast.worstMonthSurplus * EMI_FRACTION));
  return { forecast, sustainableEmi: emi };
}
