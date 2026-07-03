import type {
  InsertMsmeMaster,
  InsertTransactions,
} from "@workspace/db/schema";
import { generateDataset } from "../scripts/generate-data";
import {
  groupRawByMsme,
  computeFeatures,
  type RawSourceData,
} from "../features";
import {
  assembleCard,
  scoreMsme,
  getModels,
  type Card,
  type FeatureSnapshot,
} from "../scoring";

// The runtime "DB" is Gate 1's seeded, in-memory dataset — the same seed/count
// the models were trained on, so scores line up. No live Postgres is required.
const SEED = 424242;
const COUNT = 2000;

interface Store {
  masters: InsertMsmeMaster[];
  rawById: Map<string, RawSourceData>;
}

let store: Store | null = null;

function getStore(): Store {
  if (store) return store;
  const ds = generateDataset({ seed: SEED, count: COUNT });
  store = { masters: ds.msmeMaster, rawById: groupRawByMsme(ds) };
  return store;
}

export function getRaw(id: string): RawSourceData | undefined {
  return getStore().rawById.get(id);
}

/** Monthly net-inflow snapshots from a transaction history (for the forecast). */
export function monthlySnapshots(
  transactions: InsertTransactions[],
): FeatureSnapshot[] {
  const byMonth = new Map<string, number>();
  for (const t of transactions) {
    const m = t.date.slice(0, 7);
    const signed = t.direction === "credit" ? t.amount : -t.amount;
    byMonth.set(m, (byMonth.get(m) ?? 0) + signed);
  }
  return [...byMonth.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([month, net]) => ({ month, avgMonthlyNetInflow: net }));
}

/** Full scorecard for one MSME, or null if the id is unknown. */
export function computeCard(id: string): Card | null {
  const raw = getRaw(id);
  if (!raw) return null;
  const f = computeFeatures(id, raw);
  return assembleCard(id, f, monthlySnapshots(raw.transactions));
}

// --- /card cache -------------------------------------------------------------

const cardCache = new Map<string, Card>();

export function cacheCard(card: Card): void {
  cardCache.set(card.msme_id, card);
}

export function getCachedCard(id: string): Card | undefined {
  return cardCache.get(id);
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
export function buildPortfolio(): Portfolio {
  const { masters, rawById } = getStore();
  const models = getModels();

  const bucketCounts = new Map<string, number>(
    SCORE_BUCKETS.map((b) => [b.label, 0]),
  );
  const sectors = new Map<string, { count: number; sum: number }>();
  let pdSum = 0;

  for (const m of masters) {
    const raw = rawById.get(m.msmeId)!;
    const score = scoreMsme(computeFeatures(m.msmeId, raw), models).overall_score;

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
