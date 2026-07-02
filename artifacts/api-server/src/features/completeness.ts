import type { RawSourceData, CompletenessVector } from "./types";
import { clamp } from "./util";

export const SOURCE_NAMES = ["gst", "transactions", "epfo", "obligations"] as const;

/**
 * Data completeness vector. `coverageScore` blends how many of the four sources
 * are present with how many months of history exist (capped at 12), each
 * weighted equally, into a [0, 1] score. Thin-file MSMEs (missing sources or
 * short history) score lower — this is what Gate 3 calibrates confidence against.
 */
export function computeCompleteness(raw: RawSourceData): CompletenessVector {
  const sourcesPresent: string[] = [];
  if (raw.gstReturns.length) sourcesPresent.push("gst");
  if (raw.transactions.length) sourcesPresent.push("transactions");
  if (raw.epfo.length) sourcesPresent.push("epfo");
  if (raw.obligations.length) sourcesPresent.push("obligations");

  const monthSet = new Set<string>();
  for (const g of raw.gstReturns) monthSet.add(g.period);
  for (const e of raw.epfo) monthSet.add(e.period);
  for (const t of raw.transactions) monthSet.add(t.date.slice(0, 7));
  const monthsOfHistory = monthSet.size;

  const sourceScore = sourcesPresent.length / SOURCE_NAMES.length;
  const monthScore = Math.min(monthsOfHistory, 12) / 12;
  const coverageScore = clamp(0.5 * sourceScore + 0.5 * monthScore, 0, 1);

  return { sourcesPresent, monthsOfHistory, coverageScore };
}
