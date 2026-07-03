import type { FeatureRecord } from "../features";
import { PILLARS } from "./pillars";
import { getModels } from "./train";
import { scoreMsme } from "./score";
import { reasonCodes } from "./explain";
import { mapCompletenessToConfidence } from "./confidence";
import { sustainableEmi } from "./repayment";
import {
  forecastScore,
  DEFAULT_BASE_MONTH,
  type FeatureSnapshot,
} from "./forecast";

export type { ModelBundle, PillarModel } from "./train";
export { trainModels, getModels, saveModels } from "./train";
export { scoreMsme, ratingBand } from "./score";
export { reasonCodes, overallReason } from "./explain";
export { mapCompletenessToConfidence } from "./confidence";
export { sustainableEmi } from "./repayment";
export { forecastScore } from "./forecast";
export type { FeatureSnapshot, Forecast } from "./forecast";

/**
 * Full scorecard — this is the API contract (field names are exact).
 */
export interface Card {
  msme_id: string;
  overall_score: number;
  rating_band: string;
  pillars: { name: string; score: number; reasons: string[] }[];
  confidence: { level: string; raise_by: string };
  repayment: { sustainable_emi: number; basis: string };
  flags: { consistency_alert: boolean; detail: string };
  forecast: { months: string[]; projected_net_surplus: number[] };
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

/**
 * Assemble the full scorecard for one MSME from its feature record.
 *
 * `history` is the MSME's monthly net-inflow series, used only for the forward
 * projection. When it is omitted (or empty) the forecast falls back to a flat
 * projection off the current average, so the card shape is always complete.
 */
export function assembleCard(
  msmeId: string,
  f: FeatureRecord,
  history: FeatureSnapshot[] = [],
): Card {
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
  const forecast = forecastScore(
    msmeId,
    history.length
      ? history
      : [{ month: DEFAULT_BASE_MONTH, avgMonthlyNetInflow: f.avgMonthlyNetInflow }],
  );

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
    forecast,
  };
}
