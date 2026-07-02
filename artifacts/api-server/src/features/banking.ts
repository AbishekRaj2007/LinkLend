import type { InsertTransactions, InsertObligations } from "@workspace/db/schema";
import { mean, cv, safeDiv, clamp } from "./util";

export interface BankingFeatures {
  bounceRate: number;
  avgBalanceBuffer: number;
  balanceStabilityCV: number;
  minBalanceEventCount: number;
}

/** Banking Behaviour — bounces, balance buffer, stability, and low-balance events. */
export function computeBanking(
  transactions: InsertTransactions[],
  obligations: InsertObligations[],
  monthsOfHistory: number,
): BankingFeatures {
  const bounceCount = obligations.length ? obligations[0].bounceCount : 0;
  // Bounces per active month, capped at 1 so it reads as a [0,1] rate.
  const bounceRate = clamp(
    safeDiv(bounceCount, Math.max(monthsOfHistory, 1), 0),
    0,
    1,
  );

  const balances = transactions.map((t) => t.runningBalance);
  const avgBalanceBuffer = balances.length ? mean(balances) : 0;
  const balanceStabilityCV = cv(balances);

  // Low-balance events: transactions whose balance dips below 25% of the median.
  let minBalanceEventCount = 0;
  if (balances.length) {
    const s = [...balances].sort((a, b) => a - b);
    const median = s[Math.floor(s.length / 2)];
    const threshold = 0.25 * median;
    minBalanceEventCount = balances.filter((b) => b < threshold).length;
  }

  return {
    bounceRate,
    avgBalanceBuffer,
    balanceStabilityCV,
    minBalanceEventCount,
  };
}
