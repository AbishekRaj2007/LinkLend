import type { MsmeBundle, TransactionRecord } from "../types";
import type { FeatureKey } from "../features/catalog";
import { scoreMsme, type Scorecard, type PillarScore } from "./score";
import type { ReasonCode } from "./explain";

/**
 * Full scorecard — this is the API contract (field names are exact, driven by
 * lib/api-spec/openapi.yaml's CardResponse schema and the msme_score_history
 * jsonb columns in @workspace/db). The scoring internals below (features,
 * ml/, synthetic/, model artifact) are free to evolve; this shape may not
 * change without updating the spec, the generated zod/client, and the schema.
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

// Plain-language phrase per feature, chosen by the SIGN of the contribution: a
// positive contribution lifts the score (favorable), negative drags it (adverse).
const PHRASES: Record<FeatureKey, { favorable: string; adverse: string }> = {
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

function phraseFor(reason: ReasonCode): string {
  const p = PHRASES[reason.feature];
  if (!p) {
    return reason.direction === "positive"
      ? `Favorable ${reason.label}`
      : `Adverse ${reason.label}`;
  }
  return reason.direction === "positive" ? p.favorable : p.adverse;
}

function pillarToCard(p: PillarScore): Card["pillars"][number] {
  return { name: p.label, score: p.subScore, reasons: p.reasons.map(phraseFor) };
}

const REPAYMENT_BASIS =
  "40% of the projected worst-month net cashflow surplus (6-month linear-trend " +
  "forecast off monthly transaction history, stressed by one historical " +
  "standard deviation), floored at 0.";

// Used only when there is no dated transaction history to anchor month labels to.
const DEFAULT_BASE_MONTH = "2024-01";

/** Advance a "YYYY-MM" label by `k` months. */
function shiftMonth(month: string, k: number): string {
  const [y, m] = month.split("-").map(Number);
  const zero = y * 12 + (m - 1) + k;
  const yy = Math.floor(zero / 12);
  const mm = (zero % 12) + 1;
  return `${yy}-${String(mm).padStart(2, "0")}`;
}

/** Forward month labels aligned to forecastCashflow's fixed-horizon projection. */
function forecastMonths(transactions: TransactionRecord[], horizon: number): string[] {
  const months = transactions.map((t) => t.date.slice(0, 7)).sort();
  const lastMonth = months.length ? months[months.length - 1]! : DEFAULT_BASE_MONTH;
  return Array.from({ length: horizon }, (_, i) => shiftMonth(lastMonth, i + 1));
}

/** Assemble the full Card for one MSME from its already-fetched bundle. */
export function assembleCard(bundle: MsmeBundle): Card {
  const sc: Scorecard = scoreMsme(bundle);

  return {
    msme_id: sc.msmeId,
    overall_score: sc.overallScore,
    rating_band: sc.ratingBand,
    pillars: sc.pillars.map(pillarToCard),
    confidence: {
      level: sc.confidence.level,
      raise_by:
        sc.confidence.raiseBy ??
        "All key inputs present — confidence is already at its maximum.",
    },
    repayment: {
      sustainable_emi: sc.repayment.sustainableEmi,
      basis: REPAYMENT_BASIS,
    },
    flags: {
      consistency_alert: sc.flags.consistencyAlert,
      detail: sc.flags.detail ?? "No material cross-source inconsistencies detected.",
    },
    forecast: {
      months: forecastMonths(bundle.transactions, sc.repayment.forecast.projected.length),
      projected_net_surplus: sc.repayment.forecast.projected,
    },
  };
}
