import { describe, it, expect } from "vitest";
import { generateDataset } from "../scripts/generate-data";
import { computeFeatures, groupRawByMsme, type FeatureRecord } from "./index";
import type { RawSourceData } from "./types";

// ---------------------------------------------------------------------------
// Cohort classification derived purely from raw data shape (same signatures as
// Gate 1), used only to pick representative MSMEs and to group assertions.
// ---------------------------------------------------------------------------
type Cohort = "normal" | "thin" | "fraud" | "strong";
const SALARY_ASSUMED = 15000;
const FRAUD_RATIO = 3;
const CONSISTENCY_THRESHOLD = 0.5; // consistency features below this = "fires"

function classify(raw: RawSourceData): Cohort {
  const gstMonths = raw.gstReturns.length;
  const hasEpfo = raw.epfo.length > 0;
  const hasTxn = raw.transactions.length > 0;
  if (gstMonths >= 20) return "strong";
  if (gstMonths < 5) return "thin";
  if (!hasEpfo || !hasTxn) return "thin";
  const turnover = raw.gstReturns.reduce((s, g) => s + g.turnover, 0);
  const credit = raw.transactions
    .filter((t) => t.direction === "credit")
    .reduce((s, t) => s + t.amount, 0);
  const payroll = raw.transactions
    .filter((t) => t.direction === "debit" && t.category === "payroll")
    .reduce((s, t) => s + t.amount, 0);
  const empMonths = raw.epfo.reduce((s, e) => s + e.employeeCount, 0);
  const gstVsCredit = turnover / Math.max(credit, 1);
  const epfoVsPayroll = (empMonths * SALARY_ASSUMED) / Math.max(payroll, 1);
  if (gstVsCredit > FRAUD_RATIO || epfoVsPayroll > FRAUD_RATIO) return "fraud";
  return "normal";
}

/** Every plain numeric field in a FeatureRecord (excludes msmeId + nested vector). */
function numericFields(f: FeatureRecord): number[] {
  const { msmeId: _id, completeness, ...nums } = f;
  return [
    ...(Object.values(nums) as number[]),
    completeness.monthsOfHistory,
    completeness.coverageScore,
  ];
}

describe("features", () => {
  const ds = generateDataset({ seed: 424242, count: 2000 });
  const rawById = groupRawByMsme(ds);

  // Compute features + cohort for every MSME once.
  const rows: { id: string; cohort: Cohort; f: FeatureRecord; raw: RawSourceData }[] =
    [];
  for (const [id, raw] of rawById) {
    rows.push({ id, cohort: classify(raw), f: computeFeatures(id, raw), raw });
  }

  const byCohort = (c: Cohort) => rows.filter((r) => r.cohort === c);

  it("computes features for a sampled normal, thin-file, and fraud MSME", () => {
    for (const c of ["normal", "thin", "fraud"] as Cohort[]) {
      const sample = byCohort(c)[0];
      expect(sample, `expected at least one ${c} MSME`).toBeDefined();
      const f = computeFeatures(sample.id, sample.raw);
      expect(f.msmeId).toBe(sample.id);
      expect(f.completeness.sourcesPresent.length).toBeGreaterThan(0);
      // Thin-file must not throw and must still yield a full, finite record.
      for (const v of numericFields(f)) expect(Number.isFinite(v)).toBe(true);
    }
  });

  it("produces only finite numeric features across the full 2000-MSME dataset", () => {
    for (const { id, f } of rows) {
      for (const v of numericFields(f)) {
        expect(Number.isFinite(v), `non-finite feature for ${id}`).toBe(true);
      }
    }
  });

  it("keeps every feature within its documented sane range", () => {
    for (const { f } of rows) {
      // Proportions / rates: fractions in [0, 1].
      for (const v of [
        f.gstOnTimeFilingPct,
        f.monthsFiledOverMonthsActive,
        f.bounceRate,
        f.epfoContributionConsistency,
        f.completeness.coverageScore,
      ]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }

      expect([0, 1]).toContain(f.epfoActiveFlag);

      // CVs and seasonality: non-negative.
      for (const v of [
        f.turnoverVolatilityCV,
        f.inflowVolatilityCV,
        f.balanceStabilityCV,
        f.seasonalityIndex,
      ]) {
        expect(v).toBeGreaterThanOrEqual(0);
      }

      // Ratios: non-negative.
      for (const v of [
        f.gstToUpiRatio,
        f.epfoHeadcountToPayrollRatio,
        f.obligationToInflowRatio,
        f.dscrProxy,
        f.runwayMonths,
      ]) {
        expect(v).toBeGreaterThanOrEqual(0);
      }

      // Counts: non-negative integers.
      for (const v of [
        f.negativeBalanceDays,
        f.minBalanceEventCount,
        f.obligationCount,
        f.completeness.monthsOfHistory,
      ]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(v)).toBe(true);
      }
    }
  });

  it("fires consistency features for fraud, but not for normal/strong", () => {
    const fraud = byCohort("fraud");
    expect(fraud.length).toBeGreaterThan(0);
    for (const { id, f } of fraud) {
      const worst = Math.min(f.gstToUpiRatio, f.epfoHeadcountToPayrollRatio);
      expect(worst, `fraud ${id} should fire a consistency feature`).toBeLessThan(
        CONSISTENCY_THRESHOLD,
      );
    }
    for (const { id, f } of [...byCohort("normal"), ...byCohort("strong")]) {
      expect(
        f.gstToUpiRatio,
        `${id} gstToUpiRatio should be consistent`,
      ).toBeGreaterThanOrEqual(CONSISTENCY_THRESHOLD);
      expect(
        f.epfoHeadcountToPayrollRatio,
        `${id} epfoHeadcountToPayrollRatio should be consistent`,
      ).toBeGreaterThanOrEqual(CONSISTENCY_THRESHOLD);
    }
  });

  it("has lower mean coverageScore for thin-file than for normal/strong", () => {
    const meanCoverage = (c: Cohort) => {
      const xs = byCohort(c).map((r) => r.f.completeness.coverageScore);
      return xs.reduce((a, b) => a + b, 0) / xs.length;
    };
    const thin = meanCoverage("thin");
    expect(thin).toBeLessThan(meanCoverage("normal"));
    expect(thin).toBeLessThan(meanCoverage("strong"));
  });
});
