import { describe, it, expect } from "vitest";
import { generateDataset } from "../scripts/generate-data";
import { computeFeatures, groupRawByMsme } from "../features";
import type { RawSourceData } from "../features";
import { assembleCard, type Card } from "./index";

// ---------------------------------------------------------------------------
// Cohort classification from raw data shape (same signatures as Gates 1 & 2),
// used to pick representative MSMEs.
// ---------------------------------------------------------------------------
type Cohort = "normal" | "thin" | "fraud" | "strong";
const SALARY_ASSUMED = 15000;

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
  if (turnover / Math.max(credit, 1) > 3 || (empMonths * SALARY_ASSUMED) / Math.max(payroll, 1) > 3)
    return "fraud";
  return "normal";
}

// Spearman = Pearson on ranks.
function ranks(xs: number[]): number[] {
  const order = xs.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const r = new Array<number>(xs.length);
  let k = 0;
  while (k < order.length) {
    let j = k;
    while (j + 1 < order.length && order[j + 1].v === order[k].v) j++;
    const avg = (k + j) / 2 + 1; // 1-based average rank for ties
    for (let m = k; m <= j; m++) r[order[m].i] = avg;
    k = j + 1;
  }
  return r;
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

function spearman(x: number[], y: number[]): number {
  return pearson(ranks(x), ranks(y));
}

describe("scoring / assembleCard", () => {
  const ds = generateDataset({ seed: 424242, count: 2000 });
  const rawById = groupRawByMsme(ds);
  const latentById = new Map(ds.msmeMaster.map((m) => [m.msmeId, m.latentHealth]));

  const withCohort = ds.msmeMaster.map((m) => {
    const raw = rawById.get(m.msmeId)!;
    return { id: m.msmeId, cohort: classify(raw), raw };
  });
  const sampleOf = (c: Cohort) => withCohort.find((r) => r.cohort === c)!;

  function cardFor(id: string): Card {
    return assembleCard(id, computeFeatures(id, rawById.get(id)!));
  }

  it("produces a full, well-shaped card for normal, thin-file, and fraud MSMEs", () => {
    for (const c of ["normal", "thin", "fraud"] as Cohort[]) {
      const s = sampleOf(c);
      expect(s, `expected a ${c} MSME`).toBeDefined();
      const card = cardFor(s.id);

      expect(card.msme_id).toBe(s.id);
      expect(Number.isFinite(card.overall_score)).toBe(true);
      expect(card.overall_score).toBeGreaterThanOrEqual(0);
      expect(card.overall_score).toBeLessThanOrEqual(100);
      expect(typeof card.rating_band).toBe("string");
      expect(card.rating_band.length).toBeGreaterThan(0);
      expect(card.pillars).toHaveLength(5);
      expect(typeof card.repayment.sustainable_emi).toBe("number");
      expect(card.repayment.sustainable_emi).toBeGreaterThanOrEqual(0);
      expect(card.repayment.basis.length).toBeGreaterThan(0);
    }
  });

  it("gives every pillar a non-empty reasons array for all three samples", () => {
    for (const c of ["normal", "thin", "fraud"] as Cohort[]) {
      const card = cardFor(sampleOf(c).id);
      for (const p of card.pillars) {
        expect(p.reasons.length, `${c}/${p.name} reasons`).toBeGreaterThan(0);
        for (const r of p.reasons) expect(r.length).toBeGreaterThan(0);
      }
    }
  });

  it("assigns thin-file MSMEs Low/Medium confidence with a concrete raise_by", () => {
    const card = cardFor(sampleOf("thin").id);
    expect(["Low", "Medium"]).toContain(card.confidence.level);
    expect(card.confidence.raise_by.length).toBeGreaterThan(0);
  });

  it("raises a consistency alert with detail for fraud MSMEs", () => {
    const card = cardFor(sampleOf("fraud").id);
    expect(card.flags.consistency_alert).toBe(true);
    expect(card.flags.detail.length).toBeGreaterThan(0);
  });

  it("overall_score is monotonic-ish with latent_health (Spearman > 0.5)", () => {
    const sample = withCohort.slice(0, 50);
    const latent = sample.map((s) => latentById.get(s.id)!);
    const overall = sample.map((s) => cardFor(s.id).overall_score);
    const rho = spearman(overall, latent);
    expect(rho).toBeGreaterThan(0.5);
  });
});
