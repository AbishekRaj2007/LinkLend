import type { FeatureKey, FeatureVector, PillarId } from "../features/catalog";
import { sigmoid, applyPlatt, type PlattScaler } from "../ml/logreg";

/** Trained coefficients for one pillar's logistic regression. */
export interface PillarModel {
  /** Feature order these arrays are aligned to. */
  features: FeatureKey[];
  means: number[];
  stds: number[];
  weights: number[];
  bias: number;
  /** Platt recalibration, applied only if training found it improved ECE. */
  platt: PlattScaler | null;
}

export interface ModelArtifact {
  trainedAt: string;
  seed: number;
  n: number;
  pillars: Record<PillarId, PillarModel>;
}

export interface PillarEvaluation {
  /** Standardized feature values, aligned to `model.features`. */
  standardized: number[];
  /** Raw logit z = w·x + b. */
  logit: number;
  /** Calibrated P(non-default). */
  probability: number;
  /** round(probability * 100), clamped [0,100]. */
  subScore: number;
}

/**
 * Evaluate one pillar: standardize its features with the stored mean/std, apply
 * the logistic weights, then the calibrated probability and 0–100 sub-score.
 */
export function evaluatePillar(
  model: PillarModel,
  features: FeatureVector,
): PillarEvaluation {
  const standardized: number[] = [];
  let logit = model.bias;
  for (let j = 0; j < model.features.length; j++) {
    const key = model.features[j]!;
    const raw = features[key];
    const z = (raw - model.means[j]!) / (model.stds[j]! || 1);
    standardized.push(z);
    logit += model.weights[j]! * z;
  }
  const probability = model.platt ? applyPlatt(model.platt, logit) : sigmoid(logit);
  const subScore = Math.min(100, Math.max(0, Math.round(probability * 100)));
  return { standardized, logit, probability, subScore };
}
