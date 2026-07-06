import { describe, it, expect } from "vitest";
import { auc, brier, ece, accuracyAt } from "./metrics";

describe("metrics", () => {
  it("auc is 1 for perfect separation and 0.5 for constant scores", () => {
    expect(auc([0.1, 0.2, 0.8, 0.9], [0, 0, 1, 1])).toBe(1);
    expect(auc([0.5, 0.5, 0.5, 0.5], [0, 1, 0, 1])).toBe(0.5);
  });

  it("auc handles ties with averaged ranks", () => {
    // Two positives and two negatives, one tie straddling the boundary.
    const a = auc([0.2, 0.5, 0.5, 0.8], [0, 0, 1, 1]);
    expect(a).toBeGreaterThan(0.5);
    expect(a).toBeLessThanOrEqual(1);
  });

  it("brier and accuracy behave at extremes", () => {
    expect(brier([1, 0], [1, 0])).toBe(0);
    expect(accuracyAt([0.9, 0.1], [1, 0])).toBe(1);
    expect(accuracyAt([0.9, 0.1], [0, 1])).toBe(0);
  });

  it("ece is ~0 for perfectly calibrated predictions", () => {
    const probs = [0.0, 0.0, 1.0, 1.0];
    const labels = [0, 0, 1, 1];
    expect(ece(probs, labels)).toBeCloseTo(0, 5);
  });
});
