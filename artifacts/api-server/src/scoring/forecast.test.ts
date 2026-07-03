import { describe, it, expect } from "vitest";
import { generateDataset } from "../scripts/generate-data";
import { groupRawByMsme, computeFeatures } from "../features";
import type { InsertTransactions } from "@workspace/db/schema";
import { forecastScore, assembleCard, type FeatureSnapshot } from "./index";

const mean = (xs: number[]) =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;

/** Bucket a transaction history into monthly net-inflow snapshots. */
function monthlySnapshots(transactions: InsertTransactions[]): FeatureSnapshot[] {
  const byMonth = new Map<string, number>();
  for (const t of transactions) {
    const m = t.date.slice(0, 7);
    const signed = t.direction === "credit" ? t.amount : -t.amount;
    byMonth.set(m, (byMonth.get(m) ?? 0) + signed);
  }
  return [...byMonth.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([month, net]) => ({ month, avgMonthlyNetInflow: net }));
}

describe("scoring / forecastScore", () => {
  const ds = generateDataset({ seed: 424242, count: 2000 });
  const rawById = groupRawByMsme(ds);

  // A representative MSME with real, positive-average transaction history.
  const sampled = ds.msmeMaster
    .map((m) => ({ id: m.msmeId, snaps: monthlySnapshots(rawById.get(m.msmeId)!.transactions) }))
    .find((r) => {
      const avg = mean(r.snaps.map((s) => s.avgMonthlyNetInflow));
      return r.snaps.length >= 6 && avg > 0;
    })!;

  it("returns a 3-6 month, finite, non-negative, bounded projection", () => {
    expect(sampled, "expected a sampled MSME with history").toBeDefined();
    const fc = forecastScore(sampled.id, sampled.snaps);

    expect(fc.months.length).toBeGreaterThanOrEqual(3);
    expect(fc.months.length).toBeLessThanOrEqual(6);
    expect(fc.projected_net_surplus.length).toBe(fc.months.length);

    const avg = mean(sampled.snaps.map((s) => s.avgMonthlyNetInflow));
    const ceiling = 3 * Math.abs(avg);
    for (const v of fc.projected_net_surplus) {
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(ceiling + 1e-6);
    }
  });

  it("advances month labels forward from the last observed month", () => {
    const fc = forecastScore(sampled.id, sampled.snaps);
    const last = sampled.snaps[sampled.snaps.length - 1].month;
    for (const m of fc.months) expect(m > last).toBe(true);
  });

  it("does not diverge even on an explosively growing series", () => {
    const explosive: FeatureSnapshot[] = Array.from({ length: 6 }, (_, i) => ({
      month: `2024-0${i + 1}`,
      avgMonthlyNetInflow: 1000 * 2 ** i,
    }));
    const fc = forecastScore("explosive", explosive);
    const ceiling = 3 * Math.abs(mean(explosive.map((s) => s.avgMonthlyNetInflow)));
    for (const v of fc.projected_net_surplus) {
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeLessThanOrEqual(ceiling + 1e-6);
    }
  });

  it("clamps a declining (burning-cash) series to zero, never negative", () => {
    const declining: FeatureSnapshot[] = Array.from({ length: 6 }, (_, i) => ({
      month: `2024-0${i + 1}`,
      avgMonthlyNetInflow: 5000 - 2000 * i,
    }));
    const fc = forecastScore("declining", declining);
    for (const v of fc.projected_net_surplus) {
      expect(v).toBeGreaterThanOrEqual(0);
    }
  });

  it("assembleCard now includes a well-shaped forecast, with and without history", () => {
    const f = computeFeatures(sampled.id, rawById.get(sampled.id)!);

    const withHistory = assembleCard(sampled.id, f, sampled.snaps);
    expect(withHistory.forecast.months.length).toBeGreaterThanOrEqual(3);
    expect(withHistory.forecast.months.length).toBeLessThanOrEqual(6);
    expect(withHistory.forecast.projected_net_surplus.length).toBe(
      withHistory.forecast.months.length,
    );

    const fallback = assembleCard(sampled.id, f);
    expect(fallback.forecast.months.length).toBeGreaterThanOrEqual(3);
    expect(fallback.forecast.projected_net_surplus.length).toBe(
      fallback.forecast.months.length,
    );
    for (const v of fallback.forecast.projected_net_surplus) {
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
    }
  });
});
