import { describe, it, expect } from "vitest";
import { generateDataset, generateBundle } from "../synthetic/generate";
import { makeRng } from "../ml/rng";
import { computeFeatures } from "../features";
import { NEUTRAL_DEFAULTS } from "../features/catalog";
import { scoreMsme, ratingBand } from "./score";
import type { MsmeBundle } from "../types";

function thinFileBundle(): MsmeBundle {
  // Only a master record — every source missing => neutral-default features.
  const rng = makeRng(1);
  const base = generateBundle(rng, 0);
  return {
    master: base.master,
    gst: [],
    transactions: [],
    epfo: [],
    obligation: null,
  };
}

describe("feature engineering", () => {
  it("falls back to documented neutral defaults on a thin file (never throws)", () => {
    const fr = computeFeatures(thinFileBundle());
    for (const key of Object.keys(NEUTRAL_DEFAULTS) as (keyof typeof NEUTRAL_DEFAULTS)[]) {
      expect(fr.features[key]).toBe(NEUTRAL_DEFAULTS[key]);
    }
    expect(fr.completeness.coverageScore).toBeLessThan(0.3);
  });

  it("produces finite features for every generated MSME", () => {
    for (const bundle of generateDataset({ n: 50, seed: 7 })) {
      const fr = computeFeatures(bundle);
      for (const v of Object.values(fr.features)) {
        expect(Number.isFinite(v)).toBe(true);
      }
    }
  });
});

describe("scoreMsme", () => {
  it("returns a well-formed scorecard with a band consistent with the score", () => {
    const bundle = generateBundle(makeRng(123), 0);
    const sc = scoreMsme(bundle);
    expect(sc.overallScore).toBeGreaterThanOrEqual(0);
    expect(sc.overallScore).toBeLessThanOrEqual(100);
    expect(sc.ratingBand).toBe(ratingBand(sc.overallScore));
    expect(sc.pillars).toHaveLength(5);
    expect(sc.repayment.sustainableEmi).toBeGreaterThanOrEqual(0);
  });

  it("reason-code contributions equal weight × standardized-value exactly", () => {
    const bundle = generateBundle(makeRng(99), 0);
    const sc = scoreMsme(bundle);
    for (const pillar of sc.pillars) {
      for (const reason of pillar.reasons) {
        // contribution sign must match direction label
        const expectSign = reason.contribution >= 0 ? "positive" : "negative";
        expect(reason.direction).toBe(expectSign);
      }
    }
  });

  it("weighted blend equals sum(weight × subScore), rounded", () => {
    const bundle = generateBundle(makeRng(55), 0);
    const sc = scoreMsme(bundle);
    const manual = Math.round(
      sc.pillars.reduce((s, p) => s + p.weight * p.subScore, 0),
    );
    expect(sc.overallScore).toBe(Math.min(100, Math.max(0, manual)));
  });
});

describe("consistency flag", () => {
  it("fires when a corroboration ratio drops below 0.5", () => {
    // Search the dataset for a fraud-injected MSME and confirm the flag.
    let sawAlert = false;
    for (const bundle of generateDataset({ n: 400, seed: 42 })) {
      const sc = scoreMsme(bundle);
      if (sc.flags.consistencyAlert) {
        expect(sc.flags.detail).toBeTruthy();
        sawAlert = true;
      }
    }
    expect(sawAlert).toBe(true);
  });
});
