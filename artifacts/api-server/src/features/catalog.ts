// Single source of truth for the feature set, pillar membership, fixed pillar
// weights, and the documented neutral default each feature falls back to when a
// thin-file MSME is missing the data needed to compute it.
//
// Every other module (feature engineering, training, scoring, reason codes)
// derives its notion of "what features exist" from here so the pipeline can
// never drift out of sync.

export const FEATURE_KEYS = [
  // Business Vitality
  "turnover6moTrend",
  "turnoverCAGR",
  "turnoverVolatilityCV",
  "invoiceCountTrend",
  "seasonalityIndex",
  // Cashflow Health
  "avgMonthlyNetInflow",
  "inflowVolatilityCV",
  "runwayMonths",
  "negativeBalanceDays",
  "dscrProxy",
  // Formalisation & Compliance
  "gstOnTimeFilingPct",
  "monthsFiledOverMonthsActive",
  "epfoActiveFlag",
  "epfoContributionConsistency",
  // Banking Behaviour
  "bounceRate",
  "avgBalanceBuffer",
  "balanceStabilityCV",
  "minBalanceEventCount",
  // Obligations & Leverage
  "obligationToInflowRatio",
  "obligationCount",
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

export type FeatureVector = Record<FeatureKey, number>;

export const PILLAR_IDS = [
  "businessVitality",
  "cashflowHealth",
  "formalisationCompliance",
  "bankingBehaviour",
  "obligationsLeverage",
] as const;

export type PillarId = (typeof PILLAR_IDS)[number];

export interface PillarMeta {
  id: PillarId;
  label: string;
  /** Fixed blend weight; the five weights sum to 1. */
  weight: number;
  features: FeatureKey[];
}

export const PILLARS: Record<PillarId, PillarMeta> = {
  businessVitality: {
    id: "businessVitality",
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
  cashflowHealth: {
    id: "cashflowHealth",
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
  formalisationCompliance: {
    id: "formalisationCompliance",
    label: "Formalisation & Compliance",
    weight: 0.2,
    features: [
      "gstOnTimeFilingPct",
      "monthsFiledOverMonthsActive",
      "epfoActiveFlag",
      "epfoContributionConsistency",
    ],
  },
  bankingBehaviour: {
    id: "bankingBehaviour",
    label: "Banking Behaviour",
    weight: 0.15,
    features: [
      "bounceRate",
      "avgBalanceBuffer",
      "balanceStabilityCV",
      "minBalanceEventCount",
    ],
  },
  obligationsLeverage: {
    id: "obligationsLeverage",
    label: "Obligations & Leverage",
    weight: 0.1,
    features: ["obligationToInflowRatio", "obligationCount"],
  },
};

export const PILLAR_ORDER: PillarId[] = [...PILLAR_IDS];

/**
 * Human-readable, direction-aware labels used to render reason codes. `good`
 * describes what a *positive* contribution to P(non-default) means for the
 * borrower; `bad` describes a negative contribution.
 */
export const FEATURE_LABELS: Record<FeatureKey, string> = {
  turnover6moTrend: "6-month turnover trend",
  turnoverCAGR: "turnover growth rate",
  turnoverVolatilityCV: "turnover stability",
  invoiceCountTrend: "invoice volume trend",
  seasonalityIndex: "seasonal concentration",
  avgMonthlyNetInflow: "average monthly net inflow",
  inflowVolatilityCV: "inflow stability",
  runwayMonths: "cash runway",
  negativeBalanceDays: "days in negative balance",
  dscrProxy: "debt-service coverage",
  gstOnTimeFilingPct: "on-time GST filing",
  monthsFiledOverMonthsActive: "GST filing coverage",
  epfoActiveFlag: "active EPFO registration",
  epfoContributionConsistency: "EPFO contribution consistency",
  bounceRate: "payment bounce rate",
  avgBalanceBuffer: "average balance buffer",
  balanceStabilityCV: "balance stability",
  minBalanceEventCount: "low-balance events",
  obligationToInflowRatio: "obligations vs inflow",
  obligationCount: "number of existing obligations",
};

/**
 * Documented neutral fallbacks. When a source is missing, the affected feature
 * takes its neutral value (chosen to standardize near the population mean so a
 * thin file is neither rewarded nor punished for the gap — the gap is disclosed
 * via the completeness vector / confidence layer instead).
 */
export const NEUTRAL_DEFAULTS: FeatureVector = {
  turnover6moTrend: 0,
  turnoverCAGR: 0,
  turnoverVolatilityCV: 0.5,
  invoiceCountTrend: 0,
  seasonalityIndex: 0.3,
  avgMonthlyNetInflow: 0,
  inflowVolatilityCV: 0.5,
  runwayMonths: 6,
  negativeBalanceDays: 0.05,
  dscrProxy: 1.5,
  gstOnTimeFilingPct: 0.5,
  monthsFiledOverMonthsActive: 0.5,
  epfoActiveFlag: 0,
  epfoContributionConsistency: 0.5,
  bounceRate: 0.05,
  avgBalanceBuffer: 1,
  balanceStabilityCV: 0.5,
  minBalanceEventCount: 1,
  obligationToInflowRatio: 0.3,
  obligationCount: 1,
};

export function emptyFeatureVector(): FeatureVector {
  return { ...NEUTRAL_DEFAULTS };
}
