// Deterministic synthetic-data generator for the SakshamScore pipeline.
//
// Design contract (see PLAN / methodology doc): every MSME has a latent health
// h in [0,1] that drives BOTH its repayment outcome AND the distributions its
// four data sources are drawn from. Feature engineering therefore recovers a
// signal that genuinely predicts the label. This is a *methodology* validation
// harness, not evidence about real-world default — the circularity is intended
// and documented.

import { makeRng, type Rng } from "../ml/rng";
import type {
  MsmeBundle,
  MsmeMasterRecord,
  GstReturnRecord,
  TransactionRecord,
  EpfoRecord,
  ObligationRecord,
} from "../types";

const SECTORS = [
  "Manufacturing",
  "Retail Trade",
  "Food Processing",
  "Textiles",
  "Logistics",
  "Services",
];
const REGIONS = ["North", "South", "East", "West", "Central", "North-East"];

const ANCHOR_YEAR = 2026;
const ANCHOR_MONTH = 6; // dataset "now" == 2026-06
const ASSUMED_MONTHLY_WAGE = 18000;

export interface GenerateOptions {
  n?: number;
  seed?: number;
}

/** Subtract `back` months from the anchor, returning "YYYY-MM". */
function periodBack(back: number): string {
  let total = ANCHOR_YEAR * 12 + (ANCHOR_MONTH - 1) - back;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}

function dayString(period: string, day: number): string {
  return `${period}-${String(day).padStart(2, "0")}`;
}

function sigmoid(z: number): number {
  return 1 / (1 + Math.exp(-z));
}

function genMaster(rng: Rng, i: number): MsmeMasterRecord {
  const h = rng.next(); // latent health, uniform
  const outcomeLabel = rng.bernoulli(sigmoid(4 * (h - 0.5))); // healthier => repays
  const vintageMonths = Math.round(
    Math.min(48, Math.max(3, 6 + h * 30 + rng.gaussian(0, 4))),
  );
  const idNum = String(i + 1).padStart(5, "0");
  return {
    msmeId: `MSME${idNum}`,
    udyamId: `UDYAM-${rng.pick(REGIONS).slice(0, 2).toUpperCase()}-${rng.int(10, 99)}-${idNum}`,
    gstin: `${rng.int(10, 37)}ABCDE${idNum.slice(0, 4)}F1Z${rng.int(1, 9)}`,
    sector: rng.pick(SECTORS),
    region: rng.pick(REGIONS),
    vintageMonths,
    ntcNtbFlag: rng.bernoulli(0.7) === 1,
    latentHealth: Number(h.toFixed(4)),
    outcomeLabel,
  };
}

interface Profile {
  historyMonths: number;
  baseTurnover: number;
  monthlyGrowth: number;
  turnoverSigma: number;
  collectionFrac: number;
  opexFrac: number;
  openingBalance: number;
  trueHeadcount: number;
  reportedHeadcount: number;
  hasEpfo: boolean;
  fraudGst: boolean;
}

function genProfile(rng: Rng, m: MsmeMasterRecord): Profile {
  const h = m.latentHealth;
  const thin = rng.bernoulli(0.15) === 1;
  const historyMonths = thin ? rng.int(3, 6) : rng.int(12, 18);
  const baseTurnover = Math.exp(rng.gaussian(Math.log(400_000), 0.7));

  // Fraud subsets: ~4% overstate turnover on paper, ~4% overstate headcount.
  const fraudGst = rng.bernoulli(0.04) === 1;
  const fraudEpfo = rng.bernoulli(0.04) === 1;

  const trueHeadcount = Math.max(1, Math.round(baseTurnover / 250_000 + rng.gaussian(0, 1)));
  const hasEpfo = rng.bernoulli(0.55 + h * 0.3) === 1; // healthier => more likely formal

  return {
    historyMonths,
    baseTurnover,
    monthlyGrowth: (h - 0.4) * 0.04 + rng.gaussian(0, 0.006),
    turnoverSigma: 0.05 + (1 - h) * 0.28,
    collectionFrac: fraudGst ? rng.uniform(0.2, 0.35) : rng.uniform(0.75, 1.0),
    opexFrac: 0.55 + (1 - h) * 0.5 + rng.gaussian(0, 0.04),
    openingBalance: baseTurnover * (0.25 + h * 1.4),
    trueHeadcount,
    reportedHeadcount: fraudEpfo ? trueHeadcount * 3 : trueHeadcount,
    hasEpfo,
    fraudGst,
  };
}

function genGst(rng: Rng, m: MsmeMasterRecord, p: Profile): GstReturnRecord[] {
  const rows: GstReturnRecord[] = [];
  const taxRate = rng.uniform(0.05, 0.18);
  let level = p.baseTurnover;
  for (let k = p.historyMonths - 1; k >= 0; k--) {
    level *= 1 + p.monthlyGrowth;
    const turnover = Math.max(1000, level * (1 + rng.gaussian(0, p.turnoverSigma)));
    const period = periodBack(k);
    // Filing due on the 20th of the following month.
    const dueDate = dayString(periodBack(k - 1), 20);
    const missed = rng.bernoulli((1 - m.latentHealth) * 0.15) === 1;
    let filingDate: string | null = null;
    if (!missed) {
      const onTime = rng.bernoulli(0.4 + m.latentHealth * 0.55) === 1;
      const day = onTime ? rng.int(10, 20) : rng.int(21, 28);
      filingDate = dayString(periodBack(k - 1), day);
    }
    rows.push({
      period,
      turnover: Math.round(turnover),
      taxPaid: Math.round(turnover * taxRate),
      invoiceCount: Math.max(1, Math.round(turnover / rng.uniform(8000, 20000))),
      filingDate,
      dueDate,
    });
  }
  return rows;
}

function genTransactions(
  rng: Rng,
  p: Profile,
  gst: GstReturnRecord[],
  obligation: ObligationRecord | null,
): TransactionRecord[] {
  const txns: TransactionRecord[] = [];
  let balance = p.openingBalance;
  const emi = obligation?.monthlyObligation ?? 0;
  const payroll = p.trueHeadcount * ASSUMED_MONTHLY_WAGE;

  for (const g of gst) {
    const monthInflow = g.turnover * p.collectionFrac * (1 + rng.gaussian(0, 0.08));
    const opex = g.turnover * p.opexFrac * (1 + rng.gaussian(0, 0.06));

    const push = (
      day: number,
      amount: number,
      direction: "credit" | "debit",
      counterpartyType: string,
      category: string,
    ) => {
      balance += direction === "credit" ? amount : -amount;
      txns.push({
        date: dayString(g.period, day),
        amount: Math.round(Math.max(1, amount)),
        direction,
        counterpartyType,
        category,
        runningBalance: Math.round(balance),
      });
    };

    // Inflows: two customer credits.
    push(3, monthInflow * 0.5, "credit", "customer", "sales");
    push(17, monthInflow * 0.5, "credit", "customer", "sales");
    // Outflows: payroll, two opex debits, and the EMI (if any).
    push(7, payroll, "debit", "employee", "payroll");
    push(12, opex * 0.6, "debit", "supplier", "purchases");
    push(24, opex * 0.4, "debit", "supplier", "utilities");
    if (emi > 0) push(5, emi, "debit", "lender", "emi");
  }
  return txns;
}

function genEpfo(rng: Rng, m: MsmeMasterRecord, p: Profile, gst: GstReturnRecord[]): EpfoRecord[] {
  if (!p.hasEpfo) return [];
  const rows: EpfoRecord[] = [];
  for (const g of gst) {
    const headcount = Math.max(1, Math.round(p.reportedHeadcount * (1 + rng.gaussian(0, 0.1))));
    rows.push({
      period: g.period,
      employeeCount: headcount,
      contributionAmount: Math.round(headcount * ASSUMED_MONTHLY_WAGE * 0.24 * (1 + rng.gaussian(0, 0.05))),
      paidOnTime: rng.bernoulli(0.5 + m.latentHealth * 0.45) === 1,
    });
  }
  return rows;
}

function genObligation(rng: Rng, m: MsmeMasterRecord, p: Profile): ObligationRecord | null {
  const has = rng.bernoulli(0.75) === 1;
  if (!has) return null;
  const existingEmis = rng.int(1, 4);
  const leverage = 0.1 + (1 - m.latentHealth) * 0.4; // unhealthy => higher burden
  const monthlyObligation = Math.round(p.baseTurnover * p.collectionFrac * leverage * rng.uniform(0.4, 0.8));
  const bounceCount = rng.int(0, Math.round((1 - m.latentHealth) * 5));
  return { existingEmis, monthlyObligation, bounceCount };
}

export function generateBundle(rng: Rng, i: number): MsmeBundle {
  const master = genMaster(rng, i);
  const profile = genProfile(rng, master);
  const gst = genGst(rng, master, profile);
  const obligation = genObligation(rng, master, profile);
  const transactions = genTransactions(rng, profile, gst, obligation);
  const epfo = genEpfo(rng, master, profile, gst);
  return { master, gst, transactions, epfo, obligation };
}

/** Generate a full deterministic dataset of `n` MSME bundles. */
export function generateDataset(opts: GenerateOptions = {}): MsmeBundle[] {
  const n = opts.n ?? 2000;
  const rng = makeRng(opts.seed ?? 42);
  const out: MsmeBundle[] = [];
  for (let i = 0; i < n; i++) out.push(generateBundle(rng, i));
  return out;
}
