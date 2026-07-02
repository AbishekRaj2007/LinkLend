/**
 * Synthetic MSME data generator (Gate 1).
 *
 * Produces ~2000 synthetic MSMEs with a hidden `latent_health` and a set of
 * observable signals across five source tables (msme_master, gst_returns,
 * transactions, epfo, obligations). Every observable signal is a noisy
 * function of latent_health, so a downstream model can (later) recover it.
 *
 * The core (`generateDataset`) is a pure, seeded function returning in-memory
 * rows — this is what the tests exercise, so runs are fully reproducible and
 * no live database is required. `main()` is the dev-only script path that
 * truncates the five tables and bulk-inserts a fresh dataset via Drizzle.
 */

import { pathToFileURL } from "node:url";
import {
  msmeMaster,
  gstReturns,
  transactions,
  epfo,
  obligations,
  type InsertMsmeMaster,
  type InsertGstReturns,
  type InsertTransactions,
  type InsertEpfo,
  type InsertObligations,
} from "@workspace/db/schema";

// ---------------------------------------------------------------------------
// Cohorts
// ---------------------------------------------------------------------------
export type Cohort = "normal" | "thin" | "fraud" | "strong";

export interface Dataset {
  msmeMaster: InsertMsmeMaster[];
  gstReturns: InsertGstReturns[];
  transactions: InsertTransactions[];
  epfo: InsertEpfo[];
  obligations: InsertObligations[];
}

export interface GenerateOptions {
  seed?: number;
  count?: number;
}

// Target cohort mix (must sum to 1). Detection thresholds in the test key off
// the distinct data signatures each cohort below is generated with.
const COHORT_MIX: Record<Cohort, number> = {
  normal: 0.6,
  thin: 0.2,
  fraud: 0.1,
  strong: 0.1,
};

// Assumed monthly payroll per EPFO-covered employee. The generator makes
// consistent MSMEs spend ~this much on payroll debits; the test uses the same
// figure to detect EPFO-vs-payroll fraud, so keep them in sync.
const PAYROLL_PER_EMP = 15000;

// Anchor month that generated history ends at (most recent period).
const ANCHOR_YEAR = 2026;
const ANCHOR_MONTH = 6; // 2026-06

const SECTORS = [
  "manufacturing",
  "retail",
  "services",
  "logistics",
  "textiles",
  "food-processing",
  "construction",
  "it-services",
] as const;

const REGIONS = ["north", "south", "east", "west", "central"] as const;

// ---------------------------------------------------------------------------
// Seedable PRNG (mulberry32) + distribution helpers — no Math.random anywhere.
// ---------------------------------------------------------------------------
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rng = () => number;

function uniform(rng: Rng, min: number, max: number): number {
  return min + (max - min) * rng();
}

function randInt(rng: Rng, min: number, max: number): number {
  return Math.floor(uniform(rng, min, max + 1));
}

function chance(rng: Rng, p: number): boolean {
  return rng() < p;
}

function pick<T>(rng: Rng, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

/** Standard normal via Box–Muller. */
function gauss(rng: Rng, mean: number, sd: number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return mean + sd * z;
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

/** latent_health in (0,1) via a truncated normal centred at 0.5. */
function drawLatent(rng: Rng): number {
  let v: number;
  do {
    v = gauss(rng, 0.5, 0.2);
  } while (v <= 0.02 || v >= 0.98);
  return v;
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

// ---------------------------------------------------------------------------
// Month helpers — periods are "YYYY-MM", dates are "YYYY-MM-DD" (fixed width
// so lexicographic comparison equals chronological comparison).
// ---------------------------------------------------------------------------
interface Period {
  period: string;
  year: number;
  month: number;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** `n` consecutive months ending at (anchorYear, anchorMonth), oldest first. */
function periodsEndingAt(
  anchorYear: number,
  anchorMonth: number,
  n: number,
): Period[] {
  const out: Period[] = [];
  for (let i = n - 1; i >= 0; i--) {
    // months back from anchor
    const total = anchorYear * 12 + (anchorMonth - 1) - i;
    const year = Math.floor(total / 12);
    const month = (total % 12) + 1;
    out.push({ period: `${year}-${pad2(month)}`, year, month });
  }
  return out;
}

/** Filing due date: the 11th of the month following `p`. */
function dueDateFor(p: Period): string {
  const total = p.year * 12 + (p.month - 1) + 1;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  return `${year}-${pad2(month)}-11`;
}

// ---------------------------------------------------------------------------
// Per-cohort generation parameters
// ---------------------------------------------------------------------------
interface CohortParams {
  months: number; // number of gst/epfo/transaction periods
  turnoverNoiseSd: number; // multiplicative lognormal sd on monthly turnover
  onTimeBoost: number; // added to base on-time filing probability
  bounceBase: number; // scales bounce_count
  creditFactor: number; // credit inflows / turnover (consistency knob)
  payrollPerEmp: number; // payroll debit per employee per month
  dropEpfo: boolean; // thin-file: no epfo rows at all
  dropTransactions: boolean; // thin-file: no transaction rows at all
}

function cohortParams(rng: Rng, cohort: Cohort): CohortParams {
  switch (cohort) {
    case "strong":
      return {
        months: randInt(rng, 24, 36),
        turnoverNoiseSd: 0.07,
        onTimeBoost: 0.15,
        bounceBase: 0.3,
        creditFactor: uniform(rng, 0.95, 1.05),
        payrollPerEmp: PAYROLL_PER_EMP,
        dropEpfo: false,
        dropTransactions: false,
      };
    case "fraud": {
      // Break exactly one cross-source correlation.
      const gstVsUpi = chance(rng, 0.5);
      return {
        months: randInt(rng, 6, 12),
        turnoverNoiseSd: 0.15,
        onTimeBoost: 0,
        bounceBase: 1,
        // GST turnover >> UPI/credit inflows when this fraud type is active.
        creditFactor: gstVsUpi ? uniform(rng, 0.18, 0.25) : uniform(rng, 0.9, 1.1),
        // EPFO employee_count implies far more payroll than transactions show.
        payrollPerEmp: gstVsUpi
          ? PAYROLL_PER_EMP
          : PAYROLL_PER_EMP * uniform(rng, 0.1, 0.15),
        dropEpfo: false,
        dropTransactions: false,
      };
    }
    case "thin": {
      // Two flavours of real gap: short history, or entirely missing sources.
      const shortHistory = chance(rng, 0.5);
      const dropEpfo = !shortHistory; // subtype B always drops epfo
      const dropTransactions = !shortHistory && chance(rng, 0.4);
      return {
        months: shortHistory ? randInt(rng, 2, 4) : randInt(rng, 6, 12),
        turnoverNoiseSd: 0.22,
        onTimeBoost: 0,
        bounceBase: 1.2,
        creditFactor: uniform(rng, 0.85, 1.15),
        payrollPerEmp: PAYROLL_PER_EMP,
        dropEpfo,
        dropTransactions,
      };
    }
    case "normal":
    default:
      return {
        months: randInt(rng, 6, 12),
        turnoverNoiseSd: 0.15,
        onTimeBoost: 0,
        bounceBase: 1,
        creditFactor: uniform(rng, 0.85, 1.15),
        payrollPerEmp: PAYROLL_PER_EMP,
        dropEpfo: false,
        dropTransactions: false,
      };
  }
}

// ---------------------------------------------------------------------------
// Cohort assignment — exact target counts, then a seeded Fisher–Yates shuffle.
// ---------------------------------------------------------------------------
function assignCohorts(rng: Rng, count: number): Cohort[] {
  const labels: Cohort[] = [];
  const order: Cohort[] = ["normal", "thin", "fraud", "strong"];
  let assigned = 0;
  for (const c of order) {
    const n = c === "strong" ? count - assigned : Math.round(COHORT_MIX[c] * count);
    for (let i = 0; i < n; i++) labels.push(c);
    assigned += n;
  }
  for (let i = labels.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [labels[i], labels[j]] = [labels[j], labels[i]];
  }
  return labels;
}

// ---------------------------------------------------------------------------
// Core generator (pure + seeded)
// ---------------------------------------------------------------------------
export function generateDataset(opts: GenerateOptions = {}): Dataset {
  const seed = opts.seed ?? 424242;
  const count = opts.count ?? 2000;
  const rng = mulberry32(seed);

  const ds: Dataset = {
    msmeMaster: [],
    gstReturns: [],
    transactions: [],
    epfo: [],
    obligations: [],
  };

  const cohorts = assignCohorts(rng, count);

  for (let i = 0; i < count; i++) {
    const cohort = cohorts[i];
    const p = cohortParams(rng, cohort);
    const msmeId = `MSME-${String(i + 1).padStart(6, "0")}`;

    // Latent health: strong MSMEs are healthy by construction; others vary.
    const latent =
      cohort === "strong" ? uniform(rng, 0.75, 0.98) : drawLatent(rng);

    // Default within 12 months: low probability when latent_health is high.
    const pDefault = sigmoid(-9 * (latent - 0.5));
    const outcomeLabel = chance(rng, pDefault) ? 1 : 0;

    const vintageByCohort: Record<Cohort, [number, number]> = {
      strong: [36, 120],
      normal: [12, 60],
      fraud: [12, 48],
      thin: [3, 18],
    };
    const [vMin, vMax] = vintageByCohort[cohort];
    const vintageMonths = randInt(rng, vMin, vMax);

    ds.msmeMaster.push({
      msmeId,
      udyamId: `UDYAM-${pick(rng, REGIONS).slice(0, 2).toUpperCase()}-${pad2(
        randInt(rng, 1, 35),
      )}-${String(randInt(rng, 1, 9999999)).padStart(7, "0")}`,
      gstin: `${randInt(rng, 1, 37)}${msmeId.replace(/-/g, "")}Z${randInt(rng, 0, 9)}`,
      sector: pick(rng, SECTORS),
      region: pick(rng, REGIONS),
      vintageMonths,
      ntcNtbFlag: chance(rng, cohort === "thin" ? 0.6 : 0.15),
      latentHealth: latent,
      outcomeLabel,
    });

    const months = periodsEndingAt(ANCHOR_YEAR, ANCHOR_MONTH, p.months);

    // Base monthly turnover scales with latent health.
    const baseTurnover = 200000 * (0.3 + 1.4 * latent);
    const trendSlope = (latent - 0.5) * 0.02; // healthy firms trend up
    const onTimeProb = clamp(0.2 + 0.8 * latent + p.onTimeBoost, 0.02, 0.99);

    let balance = 50000 * (0.5 + latent);

    months.forEach((m, idx) => {
      const trend = 1 + trendSlope * idx;
      const turnover =
        baseTurnover * trend * Math.exp(gauss(rng, 0, p.turnoverNoiseSd));
      const taxPaid = turnover * uniform(rng, 0.05, 0.12);
      const invoiceCount = Math.max(
        1,
        Math.round((5 + 60 * latent) * uniform(rng, 0.7, 1.3)),
      );

      // Filing behaviour: on-time / late / missed, correlated with latent.
      const due = dueDateFor(m);
      const dueMonth = due.slice(0, 7); // "YYYY-MM"
      let filingDate: string | null;
      const roll = rng();
      if (roll < onTimeProb) {
        filingDate = `${dueMonth}-${pad2(randInt(rng, 1, 11))}`; // on/before due
      } else if (roll < onTimeProb + 0.7 * (1 - onTimeProb)) {
        filingDate = `${dueMonth}-${pad2(randInt(rng, 12, 28))}`; // late
      } else {
        filingDate = null; // missed
      }

      ds.gstReturns.push({
        msmeId,
        period: m.period,
        turnover: round2(turnover),
        taxPaid: round2(taxPaid),
        invoiceCount,
        filingDate,
        dueDate: due,
      });

      // EPFO (unless this thin-file MSME has no EPFO footprint at all).
      const employeeCount = Math.max(
        1,
        Math.round((2 + 20 * latent) * uniform(rng, 0.8, 1.2)),
      );
      if (!p.dropEpfo) {
        ds.epfo.push({
          msmeId,
          period: m.period,
          employeeCount,
          contributionAmount: round2(employeeCount * 1800 * uniform(rng, 0.9, 1.1)),
          paidOnTime: chance(rng, onTimeProb),
        });
      }

      // Transactions (unless dropped for a thin-file MSME).
      if (!p.dropTransactions) {
        // Credit inflows sum to creditFactor * turnover (fraud breaks this).
        const targetCredit = turnover * p.creditFactor;
        const nCredit = randInt(rng, 2, 4);
        const weights: number[] = [];
        let wsum = 0;
        for (let k = 0; k < nCredit; k++) {
          const w = rng() + 0.2;
          weights.push(w);
          wsum += w;
        }
        weights.forEach((w, k) => {
          const amount = targetCredit * (w / wsum);
          balance += amount;
          ds.transactions.push({
            msmeId,
            date: `${m.period}-${pad2(5 + k * 3)}`,
            amount: round2(amount),
            direction: "credit",
            counterpartyType: pick(rng, ["customer", "upi", "b2b"]),
            category: pick(rng, ["sales", "upi_collection"]),
            runningBalance: round2(balance),
          });
        });

        // Payroll debit — implied by EPFO headcount (fraud breaks this).
        const payroll = employeeCount * p.payrollPerEmp * uniform(rng, 0.9, 1.1);
        balance -= payroll;
        ds.transactions.push({
          msmeId,
          date: `${m.period}-20`,
          amount: round2(payroll),
          direction: "debit",
          counterpartyType: "employee",
          category: "payroll",
          runningBalance: round2(balance),
        });

        // A couple of generic expense debits.
        const nExp = randInt(rng, 2, 3);
        for (let k = 0; k < nExp; k++) {
          const amount = turnover * uniform(rng, 0.05, 0.15);
          balance -= amount;
          ds.transactions.push({
            msmeId,
            date: `${m.period}-${pad2(22 + k)}`,
            amount: round2(amount),
            direction: "debit",
            counterpartyType: pick(rng, ["vendor", "govt", "utility"]),
            category: pick(rng, ["supplier", "rent", "utilities", "gst_payment"]),
            runningBalance: round2(balance),
          });
        }
      }
    });

    // Obligations — one summary row per MSME.
    const bounceMean = p.bounceBase * 8 * (1 - latent);
    const bounceCount = Math.max(0, Math.round(gauss(rng, bounceMean, 1.5)));
    ds.obligations.push({
      msmeId,
      existingEmis: randInt(rng, 0, Math.round(1 + 4 * (1 - latent))),
      monthlyObligation: round2(baseTurnover * uniform(rng, 0.05, 0.2)),
      bounceCount,
    });
  }

  return ds;
}

// ---------------------------------------------------------------------------
// Dev-only script entrypoint: truncate + bulk insert via Drizzle.
// ---------------------------------------------------------------------------
async function insertChunked<T>(
  rows: T[],
  insert: (chunk: T[]) => Promise<unknown>,
  chunkSize = 1000,
): Promise<void> {
  for (let i = 0; i < rows.length; i += chunkSize) {
    await insert(rows.slice(i, i + chunkSize));
  }
}

export async function main(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("generate-data is a dev-only script; refusing to run in production");
  }

  // Imported lazily so the module has no side effects when required by tests
  // (importing @workspace/db eagerly requires DATABASE_URL to be set).
  const { db, pool } = await import("@workspace/db");
  const { sql } = await import("drizzle-orm");

  const ds = generateDataset();

  await db.execute(
    sql`TRUNCATE TABLE ${msmeMaster}, ${gstReturns}, ${transactions}, ${epfo}, ${obligations} RESTART IDENTITY CASCADE`,
  );

  await insertChunked(ds.msmeMaster, (c) => db.insert(msmeMaster).values(c));
  await insertChunked(ds.gstReturns, (c) => db.insert(gstReturns).values(c));
  await insertChunked(ds.transactions, (c) => db.insert(transactions).values(c));
  await insertChunked(ds.epfo, (c) => db.insert(epfo).values(c));
  await insertChunked(ds.obligations, (c) => db.insert(obligations).values(c));

  // eslint-disable-next-line no-console
  console.log(
    `Inserted ${ds.msmeMaster.length} MSMEs: ` +
      `${ds.gstReturns.length} gst_returns, ${ds.transactions.length} transactions, ` +
      `${ds.epfo.length} epfo, ${ds.obligations.length} obligations`,
  );

  await pool.end();
}

// Run only when invoked directly (e.g. `tsx generate-data.ts`), never on import.
const invokedDirectly = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;
if (invokedDirectly) {
  main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  });
}
