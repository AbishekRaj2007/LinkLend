import type { MsmeBundle } from "../types";

/**
 * Which data sources are present and how much history exists. Drives the
 * confidence layer: instead of rejecting a thin file, we score it on neutral
 * defaults and surface the gap here so the borrower gets an actionable next step.
 */
export interface Completeness {
  hasGst: boolean;
  hasTransactions: boolean;
  hasEpfo: boolean;
  hasObligations: boolean;
  /** Distinct GST months available (proxy for observable history length). */
  gstMonths: number;
  /** Distinct transaction months available. */
  txnMonths: number;
  /** 0..1 — fraction of the four sources present, weighted by richness. */
  coverageScore: number;
}

function distinctMonths(periods: string[]): number {
  return new Set(periods).size;
}

export function computeCompleteness(bundle: MsmeBundle): Completeness {
  const hasGst = bundle.gst.length > 0;
  const hasTransactions = bundle.transactions.length > 0;
  const hasEpfo = bundle.epfo.length > 0;
  const hasObligations = bundle.obligation !== null;

  const gstMonths = distinctMonths(bundle.gst.map((g) => g.period));
  const txnMonths = distinctMonths(
    bundle.transactions.map((t) => t.date.slice(0, 7)),
  );

  // Presence of each source (0.6 of the score) plus a history-depth bonus
  // (0.4), so a source that exists but is only a month or two deep still counts
  // as thinner than a full year.
  const present =
    (hasGst ? 1 : 0) +
    (hasTransactions ? 1 : 0) +
    (hasEpfo ? 1 : 0) +
    (hasObligations ? 1 : 0);
  const presenceScore = (present / 4) * 0.6;

  const depth = Math.min(1, Math.max(gstMonths, txnMonths) / 12);
  const depthScore = depth * 0.4;

  return {
    hasGst,
    hasTransactions,
    hasEpfo,
    hasObligations,
    gstMonths,
    txnMonths,
    coverageScore: Number((presenceScore + depthScore).toFixed(4)),
  };
}
