import type { FeatureRecord } from "../features";
import { PILLARS } from "./pillars";
import { getModels } from "./train";
import { scoreMsme } from "./score";
import { reasonCodes } from "./explain";
import { mapCompletenessToConfidence } from "./confidence";
import { sustainableEmi } from "./repayment";

export type { ModelBundle, PillarModel } from "./train";
export { trainModels, getModels, saveModels } from "./train";
export { scoreMsme, ratingBand } from "./score";
export { reasonCodes, overallReason } from "./explain";
export { mapCompletenessToConfidence } from "./confidence";
export { sustainableEmi } from "./repayment";

/**
 * Full scorecard — this is the API contract (field names are exact).
 * The `forecast` field is added in Gate 4 and intentionally omitted here.
 */
export interface Card {
  msme_id: string;
  overall_score: number;
  rating_band: string;
  pillars: { name: string; score: number; reasons: string[] }[];
  confidence: { level: string; raise_by: string };
  repayment: { sustainable_emi: number; basis: string };
  flags: { consistency_alert: boolean; detail: string };
}

// Below this, a cross-source consistency ratio (~1.0 = corroborated) is treated
// as a genuine inconsistency worth flagging.
const CONSISTENCY_THRESHOLD = 0.5;

function consistencyFlag(f: FeatureRecord): {
  consistency_alert: boolean;
  detail: string;
} {
  const gstBreak = f.gstToUpiRatio < CONSISTENCY_THRESHOLD;
  const epfoBreak = f.epfoHeadcountToPayrollRatio < CONSISTENCY_THRESHOLD;

  const details: string[] = [];
  if (gstBreak) {
    details.push(
      "Declared GST turnover is materially higher than observed bank inflows.",
    );
  }
  if (epfoBreak) {
    details.push(
      "EPFO headcount implies a larger payroll than bank outflows support.",
    );
  }

  return {
    consistency_alert: gstBreak || epfoBreak,
    detail: details.length
      ? details.join(" ")
      : "No material cross-source inconsistencies detected.",
  };
}

/** Assemble the full scorecard for one MSME from its feature record. */
export function assembleCard(msmeId: string, f: FeatureRecord): Card {
  const models = getModels();
  const scored = scoreMsme(f, models);

  const pillars = scored.pillars.map((p, i) => ({
    name: p.name,
    score: p.score,
    reasons: reasonCodes(p.name, f, models.pillars[PILLARS[i].key]),
  }));

  const confidence = mapCompletenessToConfidence(f.completeness);
  const repayment = sustainableEmi(f);
  const flags = consistencyFlag(f);

  return {
    msme_id: msmeId,
    overall_score: scored.overall_score,
    rating_band: scored.rating_band,
    pillars,
    confidence: { level: confidence.level, raise_by: confidence.raiseBy },
    repayment: {
      sustainable_emi: repayment.sustainableEmi,
      basis: repayment.basis,
    },
    flags,
  };
}
