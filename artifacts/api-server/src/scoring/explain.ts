/**
 * Reason-code generation via COEFFICIENT-BASED ATTRIBUTION.
 *
 * For a linear (logistic) model, each feature's signed contribution to the score
 * is simply `coefficient_i * standardized_value_i`. We rank features by the
 * magnitude of that contribution and turn the top drivers into plain-language
 * reasons. This is a standard, well-understood explainability technique for
 * linear models — it is NOT SHAP (no game-theoretic Shapley values are computed
 * anywhere), and the term "SHAP" never appears in any type, variable, or output.
 */

import type { FeatureRecord } from "../features";
import { PILLARS, featureVector } from "./pillars";
import type { ModelBundle, PillarModel } from "./train";

interface Phrase {
  favorable: string;
  adverse: string;
}

// Plain-language phrase per feature, chosen by the SIGN of the contribution:
// a positive contribution lifts the score (favorable), negative drags it (adverse).
const PHRASES: Record<string, Phrase> = {
  // Business Vitality
  turnover6moTrend: {
    favorable: "Rising turnover over recent months",
    adverse: "Declining turnover in recent months",
  },
  turnoverCAGR: {
    favorable: "Healthy long-run turnover growth",
    adverse: "Weak long-run turnover growth",
  },
  turnoverVolatilityCV: {
    favorable: "Steady, low-volatility turnover",
    adverse: "Erratic month-to-month turnover",
  },
  invoiceCountTrend: {
    favorable: "Growing invoice volume",
    adverse: "Shrinking invoice volume",
  },
  seasonalityIndex: {
    favorable: "Well-contained seasonal swings",
    adverse: "Large seasonal revenue swings",
  },
  // Cashflow Health
  avgMonthlyNetInflow: {
    favorable: "Strong average monthly net inflow",
    adverse: "Thin or negative monthly net inflow",
  },
  inflowVolatilityCV: {
    favorable: "Stable, predictable cash inflows",
    adverse: "Volatile cashflow in recent months",
  },
  runwayMonths: {
    favorable: "Comfortable cash runway",
    adverse: "Short cash runway",
  },
  negativeBalanceDays: {
    favorable: "Rarely runs a negative balance",
    adverse: "Frequent negative-balance periods",
  },
  dscrProxy: {
    favorable: "Comfortably covers debt service",
    adverse: "Tight debt-service coverage",
  },
  // Formalisation & Compliance
  gstOnTimeFilingPct: {
    favorable: "Consistent on-time GST filing",
    adverse: "Frequent late or missed GST filings",
  },
  monthsFiledOverMonthsActive: {
    favorable: "Complete GST filing history",
    adverse: "Thin GST filing history",
  },
  epfoActiveFlag: {
    favorable: "Active EPFO registration",
    adverse: "No EPFO footprint",
  },
  epfoContributionConsistency: {
    favorable: "Regular EPFO contributions",
    adverse: "Irregular EPFO contributions",
  },
  // Banking Behaviour
  bounceRate: {
    favorable: "No recent payment bounces",
    adverse: "Elevated payment-bounce rate",
  },
  avgBalanceBuffer: {
    favorable: "Healthy average balance buffer",
    adverse: "Low average balance buffer",
  },
  balanceStabilityCV: {
    favorable: "Stable account balances",
    adverse: "Unstable account balances",
  },
  minBalanceEventCount: {
    favorable: "Few low-balance episodes",
    adverse: "Recurrent low-balance episodes",
  },
  // Obligations & Leverage
  obligationToInflowRatio: {
    favorable: "Low obligations relative to inflows",
    adverse: "High obligations relative to inflows",
  },
  obligationCount: {
    favorable: "Few existing obligations",
    adverse: "Multiple existing obligations",
  },
};

// epfoActiveFlag is forced to 0 whenever epfoContributionConsistency is (see
// computeCompliance) — that collinearity trained epfoActiveFlag's coefficient
// with a sign opposite the intuitive "present = good" direction its phrase
// pair assumes, so its contribution-based favorable/adverse label can
// misdescribe the actual data (e.g. "No EPFO footprint" for a company with an
// active one). epfoContributionConsistency already covers the presence
// signal correctly (it's 0 exactly when there's no footprint), so excluding
// this one feature from reason codes loses no information.
const EXCLUDED_REASON_FEATURES = new Set(["epfoActiveFlag"]);

interface Contribution {
  name: string;
  contribution: number;
}

/** Signed per-feature contributions: coefficient_i * standardized_value_i. */
function contributions(model: PillarModel, f: FeatureRecord): Contribution[] {
  const x = featureVector(f, model.featureNames);
  return model.featureNames.map((name, j) => {
    const std = model.stds[j] || 1;
    const z = (x[j] - model.means[j]) / std;
    return { name, contribution: model.weights[j] * z };
  });
}

function phraseFor(name: string, favorable: boolean): string {
  const p = PHRASES[name];
  if (!p) return favorable ? `Favorable ${name}` : `Adverse ${name}`;
  return favorable ? p.favorable : p.adverse;
}

/**
 * 2-4 human-readable reasons for a pillar, from the top contributors by absolute
 * magnitude (mixing favorable and adverse drivers as they fall out of the data).
 */
export function reasonCodes(
  _pillarName: string,
  featureRecord: FeatureRecord,
  trainedWeights: PillarModel,
): string[] {
  const ranked = contributions(trainedWeights, featureRecord)
    .filter((c) => !EXCLUDED_REASON_FEATURES.has(c.name))
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
  const top = ranked.slice(0, Math.min(3, ranked.length));
  return top.map((c) => phraseFor(c.name, c.contribution >= 0));
}

/**
 * One adverse-action-style sentence for the overall card, naming the strongest
 * limiting factors across all pillars (e.g. "Primarily limited by volatile
 * cashflow in recent months and thin GST filing history.").
 */
export function overallReason(
  featureRecord: FeatureRecord,
  models: ModelBundle,
): string {
  const all: Contribution[] = [];
  for (const p of PILLARS) {
    all.push(...contributions(models.pillars[p.key], featureRecord));
  }
  const adverse = all
    .filter((c) => c.contribution < 0 && !EXCLUDED_REASON_FEATURES.has(c.name))
    .sort((a, b) => a.contribution - b.contribution)
    .slice(0, 2);

  if (adverse.length === 0) {
    return "Well-rounded profile with no single limiting factor.";
  }
  const parts = adverse.map((c) => {
    const phrase = phraseFor(c.name, false);
    return phrase.charAt(0).toLowerCase() + phrase.slice(1);
  });
  return `Primarily limited by ${parts.join(" and ")}.`;
}
