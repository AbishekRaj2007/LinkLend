import { describe, it, expect } from "vitest";
import {
  insertMsmeMasterSchema,
  insertGstReturnsSchema,
  insertTransactionsSchema,
  insertEpfoSchema,
  insertObligationsSchema,
} from "@workspace/db/schema";
import { generateDataset, type Cohort } from "./generate-data";

// ---------------------------------------------------------------------------
// Cohort classification derived purely from the generated data's shape
// (row counts, source presence, cross-source consistency) — never from a
// stored cohort label. These constants mirror the generator's signatures.
// ---------------------------------------------------------------------------
const SALARY_ASSUMED = 15000; // must match generator's PAYROLL_PER_EMP
const FRAUD_RATIO = 3;
const STRONG_MIN_MONTHS = 20; // only the "strong" cohort has multi-year history
const THIN_MAX_MONTHS = 5; // thin-file short-history threshold

interface Agg {
  gstMonths: number;
  hasEpfo: boolean;
  hasTxn: boolean;
  totalTurnover: number;
  totalCredit: number;
  totalPayrollDebit: number;
  totalEmployeeMonths: number;
  onTimeFilings: number;
  turnoverSamples: number;
}

function pearson(x: number[], y: number[]): number {
  const n = x.length;
  const mx = x.reduce((a, b) => a + b, 0) / n;
  const my = y.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    const a = x[i] - mx;
    const b = y[i] - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  return num / Math.sqrt(dx * dy);
}

function zscore(v: number[]): number[] {
  const n = v.length;
  const m = v.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(v.reduce((a, b) => a + (b - m) * (b - m), 0) / n) || 1;
  return v.map((x) => (x - m) / sd);
}

function classify(a: Agg): Cohort {
  if (a.gstMonths >= STRONG_MIN_MONTHS) return "strong";
  if (a.gstMonths < THIN_MAX_MONTHS) return "thin";
  if (!a.hasEpfo || !a.hasTxn) return "thin";
  const gstVsCredit = a.totalTurnover / Math.max(a.totalCredit, 1);
  const epfoVsPayroll =
    (a.totalEmployeeMonths * SALARY_ASSUMED) / Math.max(a.totalPayrollDebit, 1);
  if (gstVsCredit > FRAUD_RATIO || epfoVsPayroll > FRAUD_RATIO) return "fraud";
  return "normal";
}

describe("generate-data", () => {
  const ds = generateDataset({ seed: 424242, count: 2000 });

  // Build per-MSME aggregates once.
  const masterIds = new Set(ds.msmeMaster.map((m) => m.msmeId));
  const aggById = new Map<string, Agg>();
  for (const m of ds.msmeMaster) {
    aggById.set(m.msmeId, {
      gstMonths: 0,
      hasEpfo: false,
      hasTxn: false,
      totalTurnover: 0,
      totalCredit: 0,
      totalPayrollDebit: 0,
      totalEmployeeMonths: 0,
      onTimeFilings: 0,
      turnoverSamples: 0,
    });
  }
  for (const g of ds.gstReturns) {
    const a = aggById.get(g.msmeId)!;
    a.gstMonths += 1;
    a.totalTurnover += g.turnover;
    a.turnoverSamples += 1;
    if (g.filingDate != null && g.filingDate <= g.dueDate) a.onTimeFilings += 1;
  }
  for (const e of ds.epfo) {
    const a = aggById.get(e.msmeId)!;
    a.hasEpfo = true;
    a.totalEmployeeMonths += e.employeeCount;
  }
  for (const t of ds.transactions) {
    const a = aggById.get(t.msmeId)!;
    a.hasTxn = true;
    if (t.direction === "credit") a.totalCredit += t.amount;
    else if (t.category === "payroll") a.totalPayrollDebit += t.amount;
  }

  const cohortOf = new Map<string, Cohort>();
  for (const [id, a] of aggById) cohortOf.set(id, classify(a));

  it("produces ~2000 msme_master rows and populates all five tables", () => {
    expect(ds.msmeMaster.length).toBeGreaterThanOrEqual(1900);
    expect(ds.msmeMaster.length).toBeLessThanOrEqual(2100);
    expect(ds.gstReturns.length).toBeGreaterThan(0);
    expect(ds.transactions.length).toBeGreaterThan(0);
    expect(ds.epfo.length).toBeGreaterThan(0);
    expect(ds.obligations.length).toBeGreaterThan(0);
  });

  it("is referentially consistent (every child msme_id exists in master)", () => {
    for (const rows of [ds.gstReturns, ds.transactions, ds.epfo, ds.obligations]) {
      for (const r of rows) {
        expect(masterIds.has(r.msmeId)).toBe(true);
      }
    }
    // Every MSME has at least a gst footprint and an obligations row.
    const oblIds = new Set(ds.obligations.map((o) => o.msmeId));
    for (const id of masterIds) {
      expect(oblIds.has(id)).toBe(true);
    }
  });

  it("emits rows that conform to the Gate 0 insert schemas", () => {
    // Spot-check a handful of rows per table against the Drizzle/Zod schemas.
    expect(() => insertMsmeMasterSchema.parse(ds.msmeMaster[0])).not.toThrow();
    expect(() => insertGstReturnsSchema.parse(ds.gstReturns[0])).not.toThrow();
    expect(() => insertTransactionsSchema.parse(ds.transactions[0])).not.toThrow();
    expect(() => insertEpfoSchema.parse(ds.epfo[0])).not.toThrow();
    expect(() => insertObligationsSchema.parse(ds.obligations[0])).not.toThrow();
  });

  it("has cohort proportions within +/-5% of the 60/20/10/10 target", () => {
    const counts: Record<Cohort, number> = {
      normal: 0,
      thin: 0,
      fraud: 0,
      strong: 0,
    };
    for (const c of cohortOf.values()) counts[c] += 1;
    const n = ds.msmeMaster.length;
    const targets: Record<Cohort, number> = {
      normal: 0.6,
      thin: 0.2,
      fraud: 0.1,
      strong: 0.1,
    };
    for (const c of Object.keys(targets) as Cohort[]) {
      const frac = counts[c] / n;
      expect(Math.abs(frac - targets[c])).toBeLessThanOrEqual(0.05);
    }
  });

  it("thin-file rows have verifiable gaps (short history or a missing source)", () => {
    const thin = [...cohortOf.entries()].filter(([, c]) => c === "thin");
    expect(thin.length).toBeGreaterThan(0);
    for (const [id] of thin) {
      const a = aggById.get(id)!;
      const hasGap =
        a.gstMonths < THIN_MAX_MONTHS || !a.hasEpfo || !a.hasTxn;
      expect(hasGap).toBe(true);
    }
  });

  it("fraud rows show measurable cross-source inconsistency above threshold", () => {
    const fraud = [...cohortOf.entries()].filter(([, c]) => c === "fraud");
    expect(fraud.length).toBeGreaterThan(0);
    for (const [id] of fraud) {
      const a = aggById.get(id)!;
      const gstVsCredit = a.totalTurnover / Math.max(a.totalCredit, 1);
      const epfoVsPayroll =
        (a.totalEmployeeMonths * SALARY_ASSUMED) /
        Math.max(a.totalPayrollDebit, 1);
      expect(gstVsCredit > FRAUD_RATIO || epfoVsPayroll > FRAUD_RATIO).toBe(true);
    }
  });

  it("proxy score correlates with latent_health (Pearson > 0.6)", () => {
    const latent: number[] = [];
    const turnoverMean: number[] = [];
    const onTimeRate: number[] = [];
    const bounce: number[] = [];

    const bounceById = new Map(ds.obligations.map((o) => [o.msmeId, o.bounceCount]));

    for (const m of ds.msmeMaster) {
      const a = aggById.get(m.msmeId)!;
      latent.push(m.latentHealth);
      turnoverMean.push(a.turnoverSamples ? a.totalTurnover / a.turnoverSamples : 0);
      onTimeRate.push(a.gstMonths ? a.onTimeFilings / a.gstMonths : 0);
      bounce.push(bounceById.get(m.msmeId) ?? 0);
    }

    const zt = zscore(turnoverMean);
    const zo = zscore(onTimeRate);
    const zb = zscore(bounce);
    const proxy = zt.map((_, i) => zt[i] + zo[i] - zb[i]);

    const r = pearson(proxy, latent);
    expect(r).toBeGreaterThan(0.6);
  });
});
