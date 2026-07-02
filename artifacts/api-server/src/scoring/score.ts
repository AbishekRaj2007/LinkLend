import type { FeatureRecord } from "../features";
import { PILLARS, featureVector } from "./pillars";
import { getModels, type ModelBundle, type PillarModel } from "./train";
import { sigmoid, dot, standardizeRow } from "./logistic";

export interface PillarScore {
  name: string;
  score: number;
}

export interface ScoreResult {
  pillars: PillarScore[];
  overall_score: number;
  rating_band: string;
}

/**
 * Rating bands from the overall 0-100 score (documented fixed cutoffs):
 *   >= 75  Low Risk
 *   60-74  Moderate Risk
 *   < 60   High Risk
 */
export function ratingBand(overall: number): string {
  if (overall >= 75) return "Low Risk";
  if (overall >= 60) return "Moderate Risk";
  return "High Risk";
}

/** Calibrated P(non-default) for one pillar, as a 0-100 sub-score. */
export function pillarSubScore(model: PillarModel, f: FeatureRecord): number {
  const x = featureVector(f, model.featureNames);
  const xstd = standardizeRow(x, model.means, model.stds);
  const z = dot(model.weights, xstd) + model.bias;
  const prob = model.calibration
    ? sigmoid(model.calibration.a * z + model.calibration.b)
    : sigmoid(z);
  return Math.max(0, Math.min(100, Math.round(prob * 100)));
}

/**
 * Per-pillar sub-scores + the overall score.
 *
 * overall_score is a v1 FIXED weighted combination of the pillar scores (weights
 * live in pillars.ts and sum to 1); a learnable meta-model can replace this later
 * per the original plan.
 */
export function scoreMsme(
  f: FeatureRecord,
  models: ModelBundle = getModels(),
): ScoreResult {
  const pillars: PillarScore[] = PILLARS.map((p) => ({
    name: p.label,
    score: pillarSubScore(models.pillars[p.key], f),
  }));

  const weighted = PILLARS.reduce(
    (acc, p, i) => acc + p.weight * pillars[i].score,
    0,
  );
  const overall_score = Math.max(0, Math.min(100, Math.round(weighted)));

  return { pillars, overall_score, rating_band: ratingBand(overall_score) };
}
