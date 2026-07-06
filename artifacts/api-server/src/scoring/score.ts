import type { MsmeBundle } from "../types";
import { computeFeatures, type FeatureRecord } from "../features";
import {
  PILLARS,
  PILLAR_ORDER,
  type PillarId,
} from "../features/catalog";
import { MODEL_ARTIFACT } from "./model-artifact.generated";
import { evaluatePillar, type ModelArtifact } from "./model";
import {
  pillarReasons,
  overallAdverseReasons,
  type ReasonCode,
} from "./explain";
import { computeConfidence, type Confidence } from "./confidence";
import { consistencyFlag } from "./consistency";
import { sustainableEmi, type RepaymentCapacity } from "./repayment";
import type { ConsistencyRatios } from "../features/consistency";

export type RatingBand = "Low Risk" | "Moderate Risk" | "High Risk";

export interface PillarScore {
  id: PillarId;
  label: string;
  weight: number;
  subScore: number;
  probability: number;
  reasons: ReasonCode[];
}

export interface Scorecard {
  msmeId: string;
  overallScore: number;
  ratingBand: RatingBand;
  pillars: PillarScore[];
  reasons: ReasonCode[];
  confidence: Confidence;
  flags: { consistencyAlert: boolean; detail: string | null };
  consistency: ConsistencyRatios;
  repayment: RepaymentCapacity;
}

export function ratingBand(overall: number): RatingBand {
  if (overall >= 75) return "Low Risk";
  if (overall >= 60) return "Moderate Risk";
  return "High Risk";
}

/** Score a precomputed feature record against a given model artifact. */
export function scoreFeatures(
  fr: FeatureRecord,
  repayment: RepaymentCapacity,
  artifact: ModelArtifact = MODEL_ARTIFACT,
): Scorecard {
  const pillars: PillarScore[] = [];
  const reasonsByPillar: ReasonCode[][] = [];
  let weightedSum = 0;

  for (const id of PILLAR_ORDER) {
    const meta = PILLARS[id];
    const model = artifact.pillars[id];
    const evalr = evaluatePillar(model, fr.features);
    const reasons = pillarReasons(model, evalr);
    reasonsByPillar.push(reasons);
    weightedSum += meta.weight * evalr.subScore;
    pillars.push({
      id,
      label: meta.label,
      weight: meta.weight,
      subScore: evalr.subScore,
      probability: Number(evalr.probability.toFixed(4)),
      reasons,
    });
  }

  const overallScore = Math.min(100, Math.max(0, Math.round(weightedSum)));
  const flag = consistencyFlag(fr.consistency);

  return {
    msmeId: fr.msmeId,
    overallScore,
    ratingBand: ratingBand(overallScore),
    pillars,
    reasons: overallAdverseReasons(reasonsByPillar),
    confidence: computeConfidence(fr.completeness),
    flags: { consistencyAlert: flag.alert, detail: flag.detail },
    consistency: fr.consistency,
    repayment,
  };
}

/** End-to-end: bundle -> features -> calibrated pillar scores -> scorecard. */
export function scoreMsme(
  bundle: MsmeBundle,
  artifact: ModelArtifact = MODEL_ARTIFACT,
): Scorecard {
  const fr = computeFeatures(bundle);
  const repayment = sustainableEmi(bundle.transactions);
  return scoreFeatures(fr, repayment, artifact);
}
