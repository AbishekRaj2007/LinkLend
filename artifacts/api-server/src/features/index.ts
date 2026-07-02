import type { Dataset } from "../scripts/generate-data";
import type { FeatureRecord, RawSourceData } from "./types";
import { mean, monthlyCashflow } from "./util";
import { computeVitality } from "./vitality";
import { computeCashflow } from "./cashflow";
import { computeCompliance } from "./compliance";
import { computeBanking } from "./banking";
import { computeObligations } from "./obligations";
import { computeConsistency } from "./consistency";
import { computeCompleteness } from "./completeness";

export type {
  FeatureRecord,
  RawSourceData,
  CompletenessVector,
} from "./types";

/**
 * Compute the full flat feature record for one MSME from its already-fetched
 * source rows. Pure — no DB access. Thin-file MSMEs (missing sources or short
 * history) never throw: affected features are computed on partial data or set to
 * documented defaults, and the gap is surfaced via `completeness`.
 */
export function computeFeatures(
  msmeId: string,
  raw: RawSourceData,
): FeatureRecord {
  const completeness = computeCompleteness(raw);
  const avgMonthlyInflow = mean(monthlyCashflow(raw.transactions).credit);

  return {
    msmeId,
    ...computeVitality(raw.gstReturns),
    ...computeCashflow(raw.transactions, raw.obligations),
    ...computeCompliance(raw.gstReturns, raw.epfo),
    ...computeBanking(raw.transactions, raw.obligations, completeness.monthsOfHistory),
    ...computeObligations(raw.obligations, avgMonthlyInflow),
    ...computeConsistency(raw.gstReturns, raw.transactions, raw.epfo),
    completeness,
  };
}

/**
 * Group a flat Gate 1 dataset into per-MSME `RawSourceData`, keyed by msme_id.
 * Convenience for callers (and tests) that hold the whole dataset in memory.
 */
export function groupRawByMsme(ds: Dataset): Map<string, RawSourceData> {
  const byId = new Map<string, RawSourceData>();
  for (const m of ds.msmeMaster) {
    byId.set(m.msmeId, {
      master: m,
      gstReturns: [],
      transactions: [],
      epfo: [],
      obligations: [],
    });
  }
  const ensure = (id: string): RawSourceData => {
    let r = byId.get(id);
    if (!r) {
      r = { gstReturns: [], transactions: [], epfo: [], obligations: [] };
      byId.set(id, r);
    }
    return r;
  };
  for (const g of ds.gstReturns) ensure(g.msmeId).gstReturns.push(g);
  for (const t of ds.transactions) ensure(t.msmeId).transactions.push(t);
  for (const e of ds.epfo) ensure(e.msmeId).epfo.push(e);
  for (const o of ds.obligations) ensure(o.msmeId).obligations.push(o);
  return byId;
}
