import type { FeatureRecord } from "../features";

/**
 * The five scored pillars. Each model predicts P(non-default) from ONLY its own
 * pillar's features. `weight` is the v1 fixed contribution to the overall score
 * (see score.ts) and the five weights sum to 1.
 */
export interface PillarDef {
  key: string;
  label: string;
  weight: number;
  features: string[];
}

export const PILLARS: PillarDef[] = [
  {
    key: "businessVitality",
    label: "Business Vitality",
    weight: 0.25,
    features: [
      "turnover6moTrend",
      "turnoverCAGR",
      "turnoverVolatilityCV",
      "invoiceCountTrend",
      "seasonalityIndex",
    ],
  },
  {
    key: "cashflowHealth",
    label: "Cashflow Health",
    weight: 0.3,
    features: [
      "avgMonthlyNetInflow",
      "inflowVolatilityCV",
      "runwayMonths",
      "negativeBalanceDays",
      "dscrProxy",
    ],
  },
  {
    key: "formalisationCompliance",
    label: "Formalisation & Compliance",
    weight: 0.2,
    features: [
      "gstOnTimeFilingPct",
      "monthsFiledOverMonthsActive",
      "epfoActiveFlag",
      "epfoContributionConsistency",
    ],
  },
  {
    key: "bankingBehaviour",
    label: "Banking Behaviour",
    weight: 0.15,
    features: [
      "bounceRate",
      "avgBalanceBuffer",
      "balanceStabilityCV",
      "minBalanceEventCount",
    ],
  },
  {
    key: "obligationsLeverage",
    label: "Obligations & Leverage",
    weight: 0.1,
    features: ["obligationToInflowRatio", "obligationCount"],
  },
];

/** Flat numeric view of a FeatureRecord (drops msmeId + the completeness object). */
export function numericFeatureMap(f: FeatureRecord): Record<string, number> {
  const { msmeId: _id, completeness: _c, ...rest } = f;
  return rest as unknown as Record<string, number>;
}

/** Ordered numeric vector for a pillar's feature list. */
export function featureVector(f: FeatureRecord, names: string[]): number[] {
  const m = numericFeatureMap(f);
  return names.map((n) => m[n]);
}
