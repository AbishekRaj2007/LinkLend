// Frontend mirror of the api-server Scorecard shape (artifacts/api-server/src/
// scoring/score.ts). Kept as a hand-written type because the scoring core lives
// in the server bundle, not a shared package; the /api/msmes/:id/scorecard
// response conforms to this.

export type RatingBand = "Low Risk" | "Moderate Risk" | "High Risk";

export interface ReasonCode {
  feature: string;
  label: string;
  contribution: number;
  direction: "positive" | "negative";
}

export interface PillarScore {
  id: string;
  label: string;
  weight: number;
  subScore: number;
  probability: number;
  reasons: ReasonCode[];
}

export interface Confidence {
  level: "Low" | "Medium" | "High";
  coverageScore: number;
  raiseBy: string | null;
}

export interface CashflowForecast {
  history: number[];
  projected: number[];
  worstMonthSurplus: number;
}

export interface RepaymentCapacity {
  forecast: CashflowForecast;
  sustainableEmi: number;
}

export interface Scorecard {
  msmeId: string;
  overallScore: number;
  ratingBand: RatingBand;
  pillars: PillarScore[];
  reasons: ReasonCode[];
  confidence: Confidence;
  flags: { consistencyAlert: boolean; detail: string | null };
  consistency: {
    gstToUpiRatio: number;
    epfoHeadcountToPayrollRatio: number;
  };
  repayment: RepaymentCapacity;
}

export interface MemoResponse {
  scorecard: Scorecard;
  memo: string;
}
