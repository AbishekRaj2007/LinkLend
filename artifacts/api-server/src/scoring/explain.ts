import {
  FEATURE_LABELS,
  type FeatureKey,
} from "../features/catalog";
import type { PillarModel, PillarEvaluation } from "./model";

export interface ReasonCode {
  feature: FeatureKey;
  label: string;
  /** coefficient × standardized-value — the exact contribution to the logit. */
  contribution: number;
  direction: "positive" | "negative";
}

// epfoActiveFlag is excluded from reason-code selection: its coefficient sign is
// entangled with epfoContributionConsistency via collinearity, so surfacing it
// would mislabel its direction.
const REASON_EXCLUDE: ReadonlySet<FeatureKey> = new Set(["epfoActiveFlag"]);

/**
 * Exact, coefficient-based reason codes for one pillar: contribution_j is the
 * literal weight_j × standardized_value_j from the deployed logistic regression.
 * Not a SHAP/LIME approximation — reproducible and auditable.
 */
export function pillarReasons(
  model: PillarModel,
  evalr: PillarEvaluation,
  topK = 3,
): ReasonCode[] {
  const contributions: ReasonCode[] = [];
  for (let j = 0; j < model.features.length; j++) {
    const feature = model.features[j]!;
    if (REASON_EXCLUDE.has(feature)) continue;
    const contribution = model.weights[j]! * evalr.standardized[j]!;
    contributions.push({
      feature,
      label: FEATURE_LABELS[feature],
      contribution: Number(contribution.toFixed(4)),
      direction: contribution >= 0 ? "positive" : "negative",
    });
  }
  return contributions
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
    .slice(0, topK);
}

/** The two most-adverse contributions across all pillars => overall explanation. */
export function overallAdverseReasons(
  perPillar: ReasonCode[][],
  topK = 2,
): ReasonCode[] {
  const all = perPillar.flat().filter((r) => r.contribution < 0);
  return all
    .sort((a, b) => a.contribution - b.contribution)
    .slice(0, topK);
}
