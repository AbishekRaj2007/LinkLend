import type { CompletenessVector } from "../features";

export interface ConfidenceResult {
  level: "High" | "Medium" | "Low";
  raiseBy: string;
}

// All four sources considered; ordered by how much each lifts assessment quality.
const SOURCE_PRIORITY = ["gst", "transactions", "epfo", "obligations"] as const;

const SOURCE_ACTION: Record<string, string> = {
  gst: "Adding GST filing history",
  transactions: "Linking bank transaction data",
  epfo: "Adding EPFO contribution records",
  obligations: "Adding existing-obligation records",
};

/**
 * Map a completeness vector to a confidence level with clear thresholds:
 *   High   — all 4 sources present AND >= 6 months of history
 *   Low    — 2+ sources missing (<= 2 present) OR < 3 months of history
 *   Medium — everything in between (one source missing, or 3-5 months)
 *
 * `raiseBy` names the single most impactful missing input.
 */
export function mapCompletenessToConfidence(
  cv: CompletenessVector,
): ConfidenceResult {
  const present = cv.sourcesPresent.length;
  const months = cv.monthsOfHistory;

  const level: ConfidenceResult["level"] =
    present === 4 && months >= 6
      ? "High"
      : present <= 2 || months < 3
        ? "Low"
        : "Medium";

  const nextLevel = level === "Low" ? "Medium" : "High";
  const missing = SOURCE_PRIORITY.filter(
    (s) => !cv.sourcesPresent.includes(s),
  );

  let raiseBy: string;
  if (missing.length > 0) {
    raiseBy = `${SOURCE_ACTION[missing[0]]} would raise confidence to ${nextLevel}.`;
  } else if (months < 6) {
    // All sources present but history is short.
    const reachable = months >= 5 ? "High" : "Medium";
    raiseBy = `One more GST filing cycle would raise confidence to ${reachable}.`;
  } else {
    raiseBy = "All key inputs present — confidence is already at its maximum.";
  }

  return { level, raiseBy };
}
