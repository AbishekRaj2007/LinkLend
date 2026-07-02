import type {
  InsertMsmeMaster,
  InsertGstReturns,
  InsertTransactions,
  InsertEpfo,
  InsertObligations,
} from "@workspace/db/schema";

/**
 * Already-fetched source rows for a single MSME. Feature functions are pure and
 * operate only on this — they never touch the DB, so they are trivially testable.
 */
export interface RawSourceData {
  master?: InsertMsmeMaster | null;
  gstReturns: InsertGstReturns[];
  transactions: InsertTransactions[];
  epfo: InsertEpfo[];
  obligations: InsertObligations[];
}

/**
 * Data completeness vector — drives Gate 3's confidence calibration.
 * `coverageScore` is in [0, 1]; higher = more complete (more sources, more months).
 */
export interface CompletenessVector {
  sourcesPresent: string[];
  monthsOfHistory: number;
  coverageScore: number;
}

/**
 * Flat per-MSME feature record.
 *
 * CONVENTIONS (documented once, applied everywhere):
 * - All proportions / percentages are FRACTIONS in [0, 1] (NOT 0–100), including
 *   every `*Pct`, `*Rate`, `*Consistency`, and `coverageScore` field.
 * - Coefficients of variation (`*CV`) and `seasonalityIndex` are non-negative.
 * - Ratios (`*Ratio`, `dscrProxy`, `runwayMonths`) are non-negative and capped
 *   so they stay finite.
 * - Trends (`*Trend`, `turnoverCAGR`) and net-flow / balance figures may be
 *   negative but are always finite.
 * - Cross-source consistency ratios (`gstToUpiRatio`, `epfoHeadcountToPayrollRatio`)
 *   read as coverage: ~1.0 = the two sources corroborate each other, a LOW value
 *   means they disagree (fraud fires). When the corroborating source is missing
 *   the value is the neutral 1.0 and the gap is recorded in `completeness`.
 */
export interface FeatureRecord {
  msmeId: string;

  // Business Vitality
  turnover6moTrend: number;
  turnoverCAGR: number;
  turnoverVolatilityCV: number;
  invoiceCountTrend: number;
  seasonalityIndex: number;

  // Cashflow Health
  avgMonthlyNetInflow: number;
  inflowVolatilityCV: number;
  runwayMonths: number;
  negativeBalanceDays: number;
  dscrProxy: number;

  // Formalisation & Compliance
  gstOnTimeFilingPct: number;
  monthsFiledOverMonthsActive: number;
  epfoActiveFlag: number;
  epfoContributionConsistency: number;

  // Banking Behaviour
  bounceRate: number;
  avgBalanceBuffer: number;
  balanceStabilityCV: number;
  minBalanceEventCount: number;

  // Obligations & Leverage
  obligationToInflowRatio: number;
  obligationCount: number;

  // Cross-source consistency
  gstToUpiRatio: number;
  epfoHeadcountToPayrollRatio: number;

  // Data completeness
  completeness: CompletenessVector;
}
