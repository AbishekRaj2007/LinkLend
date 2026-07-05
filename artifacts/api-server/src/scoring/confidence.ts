import type { Completeness } from "../features/completeness";

export type ConfidenceLevel = "Low" | "Medium" | "High";

export interface Confidence {
  level: ConfidenceLevel;
  coverageScore: number;
  /** Concrete next step that would raise confidence, or null if already High. */
  raiseBy: string | null;
}

/**
 * Map data completeness (not just model accuracy) to a confidence level with an
 * actionable next step. A thin file becomes a to-do list rather than a rejection.
 */
export function computeConfidence(c: Completeness): Confidence {
  const level: ConfidenceLevel =
    c.coverageScore >= 0.8 ? "High" : c.coverageScore >= 0.55 ? "Medium" : "Low";

  let raiseBy: string | null = null;
  if (level !== "High") {
    if (!c.hasEpfo) {
      raiseBy = "Adding EPFO contribution records would raise confidence.";
    } else if (!c.hasGst) {
      raiseBy = "Adding GST return filings would raise confidence.";
    } else if (!c.hasTransactions) {
      raiseBy = "Linking a bank statement feed would raise confidence.";
    } else if (Math.max(c.gstMonths, c.txnMonths) < 12) {
      raiseBy =
        "Providing a longer history (12+ months) would raise confidence.";
    } else if (!c.hasObligations) {
      raiseBy = "Adding existing-obligation records would raise confidence.";
    }
  }

  return { level, coverageScore: c.coverageScore, raiseBy };
}
