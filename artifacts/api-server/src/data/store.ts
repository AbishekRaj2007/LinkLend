import { eq, desc } from "drizzle-orm";
import {
  db,
  msmeMaster,
  gstReturns,
  transactions,
  epfo,
  obligations,
  msmeScoreHistory,
  type MsmeMaster,
} from "@workspace/db";
import type {
  MsmeBundle,
  MsmeMasterRecord,
  GstReturnRecord,
  TransactionRecord,
  EpfoRecord,
  ObligationRecord,
} from "../types";
import { assembleCard, type Card } from "../scoring";

function toMasterRecord(m: MsmeMaster): MsmeMasterRecord {
  return {
    msmeId: m.msmeId,
    udyamId: m.udyamId,
    gstin: m.gstin,
    sector: m.sector,
    region: m.region,
    vintageMonths: m.vintageMonths,
    ntcNtbFlag: m.ntcNtbFlag,
    latentHealth: m.latentHealth,
    outcomeLabel: m.outcomeLabel,
  };
}

export async function listMsmeIds(): Promise<string[]> {
  const rows = await db.select({ msmeId: msmeMaster.msmeId }).from(msmeMaster);
  return rows.map((r) => r.msmeId);
}

/** Point fetch: one MSME's bundle across all five source tables, or null if unknown. */
export async function loadBundle(msmeId: string): Promise<MsmeBundle | null> {
  const [master] = await db
    .select()
    .from(msmeMaster)
    .where(eq(msmeMaster.msmeId, msmeId))
    .limit(1);
  if (!master) return null;

  const [gstRows, txnRows, epfoRows, obRows] = await Promise.all([
    db.select().from(gstReturns).where(eq(gstReturns.msmeId, msmeId)),
    db.select().from(transactions).where(eq(transactions.msmeId, msmeId)),
    db.select().from(epfo).where(eq(epfo.msmeId, msmeId)),
    db.select().from(obligations).where(eq(obligations.msmeId, msmeId)),
  ]);

  const gst: GstReturnRecord[] = gstRows.map((g) => ({
    period: g.period,
    turnover: g.turnover,
    taxPaid: g.taxPaid,
    invoiceCount: g.invoiceCount,
    filingDate: g.filingDate,
    dueDate: g.dueDate,
  }));

  const txns: TransactionRecord[] = txnRows.map((t) => ({
    date: t.date,
    amount: t.amount,
    direction: t.direction === "credit" ? "credit" : "debit",
    counterpartyType: t.counterpartyType,
    category: t.category,
    runningBalance: t.runningBalance,
  }));

  const epfoRecs: EpfoRecord[] = epfoRows.map((e) => ({
    period: e.period,
    employeeCount: e.employeeCount,
    contributionAmount: e.contributionAmount,
    paidOnTime: e.paidOnTime,
  }));

  const ob = obRows[0];
  const obligation: ObligationRecord | null = ob
    ? {
        existingEmis: ob.existingEmis,
        monthlyObligation: ob.monthlyObligation,
        bounceCount: ob.bounceCount,
      }
    : null;

  return {
    master: toMasterRecord(master),
    gst,
    transactions: txns,
    epfo: epfoRecs,
    obligation,
  };
}

interface AllBundles {
  masters: MsmeMaster[];
  bundleById: Map<string, MsmeBundle>;
}

// The full five-table pull is ~175k rows across every MSME — fine for a
// one-time load, too slow to repeat on every /portfolio hit (each of these
// selects alone can take tens of seconds over a pooled connection). Cache it
// once per process, same freshness semantics the old in-memory dataset had.
let allBundlesCache: AllBundles | null = null;

/** Bulk fetch: every MSME's master row plus its grouped bundle (for /portfolio and validation). */
export async function getAllBundles(): Promise<AllBundles> {
  if (allBundlesCache) return allBundlesCache;

  const [masters, gstRows, txnRows, epfoRows, obRows] = await Promise.all([
    db.select().from(msmeMaster),
    db.select().from(gstReturns),
    db.select().from(transactions),
    db.select().from(epfo),
    db.select().from(obligations),
  ]);

  const gstById = new Map<string, GstReturnRecord[]>();
  for (const g of gstRows) {
    const arr = gstById.get(g.msmeId) ?? [];
    arr.push({
      period: g.period,
      turnover: g.turnover,
      taxPaid: g.taxPaid,
      invoiceCount: g.invoiceCount,
      filingDate: g.filingDate,
      dueDate: g.dueDate,
    });
    gstById.set(g.msmeId, arr);
  }

  const txnById = new Map<string, TransactionRecord[]>();
  for (const t of txnRows) {
    const arr = txnById.get(t.msmeId) ?? [];
    arr.push({
      date: t.date,
      amount: t.amount,
      direction: t.direction === "credit" ? "credit" : "debit",
      counterpartyType: t.counterpartyType,
      category: t.category,
      runningBalance: t.runningBalance,
    });
    txnById.set(t.msmeId, arr);
  }

  const epfoById = new Map<string, EpfoRecord[]>();
  for (const e of epfoRows) {
    const arr = epfoById.get(e.msmeId) ?? [];
    arr.push({
      period: e.period,
      employeeCount: e.employeeCount,
      contributionAmount: e.contributionAmount,
      paidOnTime: e.paidOnTime,
    });
    epfoById.set(e.msmeId, arr);
  }

  const obligationById = new Map<string, ObligationRecord>();
  for (const o of obRows) {
    obligationById.set(o.msmeId, {
      existingEmis: o.existingEmis,
      monthlyObligation: o.monthlyObligation,
      bounceCount: o.bounceCount,
    });
  }

  const bundleById = new Map<string, MsmeBundle>();
  for (const m of masters) {
    bundleById.set(m.msmeId, {
      master: toMasterRecord(m),
      gst: gstById.get(m.msmeId) ?? [],
      transactions: txnById.get(m.msmeId) ?? [],
      epfo: epfoById.get(m.msmeId) ?? [],
      obligation: obligationById.get(m.msmeId) ?? null,
    });
  }

  allBundlesCache = { masters, bundleById };
  return allBundlesCache;
}

/** Full scorecard for one MSME, or null if the id is unknown. */
export async function computeCard(id: string): Promise<Card | null> {
  const bundle = await loadBundle(id);
  if (!bundle) return null;
  return assembleCard(bundle);
}

// --- /card cache -------------------------------------------------------------

const cardCache = new Map<string, Card>();

export function cacheCard(card: Card): void {
  cardCache.set(card.msme_id, card);
}

export function getCachedCard(id: string): Card | undefined {
  return cardCache.get(id);
}

// --- score history -----------------------------------------------------------

/** Persist a computed card as one score-history row. */
export async function saveScoreHistory(
  card: Card,
  userId: number | null,
): Promise<void> {
  await db.insert(msmeScoreHistory).values({
    msmeId: card.msme_id,
    overallScore: card.overall_score,
    ratingBand: card.rating_band,
    pillars: card.pillars,
    confidence: card.confidence,
    repayment: card.repayment,
    flags: card.flags,
    forecast: card.forecast,
    assessedByUserId: userId,
  });
}

/** One point on an MSME's score trend (lean — for charting, not the full card). */
export interface ScoreHistoryEntry {
  id: number;
  msme_id: string;
  overall_score: number;
  rating_band: string;
  created_at: string;
}

/** All persisted assessments for an MSME, oldest first. */
export async function getScoreHistory(
  msmeId: string,
): Promise<ScoreHistoryEntry[]> {
  const rows = await db
    .select({
      id: msmeScoreHistory.id,
      msmeId: msmeScoreHistory.msmeId,
      overallScore: msmeScoreHistory.overallScore,
      ratingBand: msmeScoreHistory.ratingBand,
      createdAt: msmeScoreHistory.createdAt,
    })
    .from(msmeScoreHistory)
    .where(eq(msmeScoreHistory.msmeId, msmeId))
    .orderBy(msmeScoreHistory.createdAt);

  return rows.map((r) => ({
    id: r.id,
    msme_id: r.msmeId,
    overall_score: r.overallScore,
    rating_band: r.ratingBand,
    created_at: r.createdAt.toISOString(),
  }));
}

/** The most recent persisted assessment for an MSME, rebuilt as a full Card. */
export interface LatestScore {
  id: number;
  card: Card;
  memo: string | null;
}

export async function getLatestScore(
  msmeId: string,
): Promise<LatestScore | null> {
  const [row] = await db
    .select()
    .from(msmeScoreHistory)
    .where(eq(msmeScoreHistory.msmeId, msmeId))
    // id tie-breaks rows that share a createdAt timestamp, so "latest" is stable.
    .orderBy(desc(msmeScoreHistory.createdAt), desc(msmeScoreHistory.id))
    .limit(1);
  if (!row) return null;

  return {
    id: row.id,
    memo: row.memo,
    card: {
      msme_id: row.msmeId,
      overall_score: row.overallScore,
      rating_band: row.ratingBand,
      pillars: row.pillars,
      confidence: row.confidence,
      repayment: row.repayment,
      flags: row.flags,
      forecast: row.forecast,
    },
  };
}

/** Cache a generated memo onto a specific score-history row. */
export async function setScoreMemo(id: number, memo: string): Promise<void> {
  await db
    .update(msmeScoreHistory)
    .set({ memo })
    .where(eq(msmeScoreHistory.id, id));
}

// --- /portfolio aggregation --------------------------------------------------

const SCORE_BUCKETS: { label: string; hi: number }[] = [
  { label: "0-19", hi: 19 },
  { label: "20-39", hi: 39 },
  { label: "40-59", hi: 59 },
  { label: "60-79", hi: 79 },
  { label: "80-100", hi: 100 },
];

function bucketFor(score: number): string {
  for (const b of SCORE_BUCKETS) if (score <= b.hi) return b.label;
  return SCORE_BUCKETS[SCORE_BUCKETS.length - 1].label;
}

export interface Portfolio {
  scoreDistribution: { bucket: string; count: number }[];
  sectorConcentration: { sector: string; count: number; avgScore: number }[];
  expectedDefaultEstimate: number;
}

/** Aggregate scores across every MSME currently in the store. */
export async function buildPortfolio(): Promise<Portfolio> {
  const { masters, bundleById } = await getAllBundles();

  const bucketCounts = new Map<string, number>(
    SCORE_BUCKETS.map((b) => [b.label, 0]),
  );
  const sectors = new Map<string, { count: number; sum: number }>();
  let pdSum = 0;

  for (const m of masters) {
    const bundle = bundleById.get(m.msmeId)!;
    const score = assembleCard(bundle).overall_score;

    const b = bucketFor(score);
    bucketCounts.set(b, (bucketCounts.get(b) ?? 0) + 1);

    const s = sectors.get(m.sector) ?? { count: 0, sum: 0 };
    s.count += 1;
    s.sum += score;
    sectors.set(m.sector, s);

    // Simple PD proxy: a higher score means a lower probability of default.
    pdSum += (100 - score) / 100;
  }

  const scoreDistribution = SCORE_BUCKETS.map((b) => ({
    bucket: b.label,
    count: bucketCounts.get(b.label) ?? 0,
  }));

  const sectorConcentration = [...sectors.entries()]
    .map(([sector, v]) => ({
      sector,
      count: v.count,
      avgScore: v.sum / v.count,
    }))
    .sort((a, b) => b.count - a.count);

  const expectedDefaultEstimate = masters.length ? pdSum / masters.length : 0;

  return { scoreDistribution, sectorConcentration, expectedDefaultEstimate };
}
