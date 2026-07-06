import type {
  MsmeBundle,
  GstReturnRecord,
  TransactionRecord,
} from "../types";
import {
  emptyFeatureVector,
  NEUTRAL_DEFAULTS,
  type FeatureVector,
} from "./catalog";
import {
  cagr,
  clamp,
  cv,
  mean,
  periodKey,
  relativeSlope,
  safeDiv,
  std,
} from "./util";

// Turnover units are in ₹; net inflow is scaled to ₹-lakh so the raw feature
// sits in a friendlier numeric range before standardization.
const INFLOW_SCALE = 100_000;

function sortedGst(gst: GstReturnRecord[]): GstReturnRecord[] {
  return [...gst].sort((a, b) => periodKey(a.period) - periodKey(b.period));
}

function sortedTxns(txns: TransactionRecord[]): TransactionRecord[] {
  return [...txns].sort((a, b) => a.date.localeCompare(b.date));
}

function monthlyNet(txns: TransactionRecord[]): Map<string, number> {
  const net = new Map<string, number>();
  for (const t of txns) {
    const m = t.date.slice(0, 7);
    const signed = t.direction === "credit" ? t.amount : -t.amount;
    net.set(m, (net.get(m) ?? 0) + signed);
  }
  return net;
}

function monthlyCredits(txns: TransactionRecord[]): Map<string, number> {
  const c = new Map<string, number>();
  for (const t of txns) {
    if (t.direction !== "credit") continue;
    const m = t.date.slice(0, 7);
    c.set(m, (c.get(m) ?? 0) + t.amount);
  }
  return c;
}

function monthlyDebits(txns: TransactionRecord[]): Map<string, number> {
  const d = new Map<string, number>();
  for (const t of txns) {
    if (t.direction !== "debit") continue;
    const m = t.date.slice(0, 7);
    d.set(m, (d.get(m) ?? 0) + t.amount);
  }
  return d;
}

function isOnTime(filingDate: string | null, dueDate: string): boolean {
  if (!filingDate) return false;
  return filingDate.localeCompare(dueDate) <= 0;
}

/**
 * Compute the full feature vector for one MSME. Every feature that cannot be
 * computed (missing source, too little history) falls back to its documented
 * neutral default; the gap itself is recorded by computeCompleteness().
 */
export function computeFeatureVector(bundle: MsmeBundle): FeatureVector {
  const f = emptyFeatureVector();
  const gst = sortedGst(bundle.gst);
  const txns = sortedTxns(bundle.transactions);
  const ob = bundle.obligation;

  // --- Business Vitality (from GST) ---------------------------------------
  if (gst.length >= 2) {
    const turnovers = gst.map((g) => g.turnover);
    const invoices = gst.map((g) => g.invoiceCount);
    const last6 = turnovers.slice(-6);
    f.turnover6moTrend = relativeSlope(last6);
    f.turnoverCAGR = cagr(turnovers);
    f.turnoverVolatilityCV = cv(turnovers);
    f.invoiceCountTrend = relativeSlope(invoices.slice(-6));

    // Seasonality: dispersion of calendar-month average turnover, relative to
    // the overall mean. Higher == more concentrated in particular months.
    const byCalMonth = new Map<number, number[]>();
    for (const g of gst) {
      const mm = Number(g.period.split("-")[1]) || 0;
      const arr = byCalMonth.get(mm) ?? [];
      arr.push(g.turnover);
      byCalMonth.set(mm, arr);
    }
    const calMeans = [...byCalMonth.values()].map((xs) => mean(xs));
    f.seasonalityIndex = clamp(cv(calMeans), 0, 2);
  }

  // --- Cashflow Health (from transactions + obligations) ------------------
  if (txns.length > 0) {
    const net = [...monthlyNet(txns).values()];
    const credits = [...monthlyCredits(txns).values()];
    const debits = [...monthlyDebits(txns).values()];

    const avgNet = mean(net);
    f.avgMonthlyNetInflow = clamp(avgNet / INFLOW_SCALE, -50, 50);
    f.inflowVolatilityCV = cv(credits);

    const latestBalance = txns[txns.length - 1]!.runningBalance;
    const avgMonthlyOutflow = mean(debits);
    const avgMonthlyInflow = mean(credits);
    const burn = avgMonthlyOutflow - avgMonthlyInflow; // net cash burn per month
    if (burn > 1e-6) {
      f.runwayMonths = clamp(safeDiv(latestBalance, burn, 24), 0, 24);
    } else {
      f.runwayMonths = 24; // cash-flow positive => capped runway
    }

    const negDays = txns.filter((t) => t.runningBalance < 0).length;
    f.negativeBalanceDays = clamp(safeDiv(negDays, txns.length, 0), 0, 1);

    if (ob && ob.monthlyObligation > 0) {
      f.dscrProxy = clamp(safeDiv(avgNet, ob.monthlyObligation, 5), 0, 5);
    } else {
      f.dscrProxy = 5; // no obligations => maximal coverage
    }

    // --- Banking Behaviour ------------------------------------------------
    const balances = txns.map((t) => t.runningBalance);
    const avgBalance = mean(balances);
    f.avgBalanceBuffer = clamp(
      safeDiv(avgBalance, Math.max(avgMonthlyOutflow, 1), 0),
      0,
      12,
    );
    f.balanceStabilityCV = cv(balances);
    const lowThreshold = 0.1 * Math.max(avgBalance, 1);
    const minEvents = txns.filter((t) => t.runningBalance < lowThreshold).length;
    f.minBalanceEventCount = clamp(safeDiv(minEvents, txns.length, 0), 0, 1);
  }

  // bounceRate comes from the obligations feed (bank-reported bounces).
  if (ob) {
    const monthsObserved = Math.max(gst.length, monthlyNet(txns).size, 1);
    f.bounceRate = clamp(safeDiv(ob.bounceCount, monthsObserved, 0), 0, 1);
  }

  // --- Formalisation & Compliance -----------------------------------------
  if (gst.length > 0) {
    const onTime = gst.filter((g) => isOnTime(g.filingDate, g.dueDate)).length;
    f.gstOnTimeFilingPct = clamp(safeDiv(onTime, gst.length, 0), 0, 1);
    const filed = gst.filter((g) => g.filingDate !== null).length;
    const monthsActive = Math.max(bundle.master.vintageMonths, gst.length, 1);
    f.monthsFiledOverMonthsActive = clamp(safeDiv(filed, monthsActive, 0), 0, 1);
  }

  if (bundle.epfo.length > 0) {
    f.epfoActiveFlag = 1;
    const onTimeFrac = safeDiv(
      bundle.epfo.filter((e) => e.paidOnTime).length,
      bundle.epfo.length,
      0,
    );
    const contribCv = cv(bundle.epfo.map((e) => e.contributionAmount));
    // Consistency = mostly-on-time AND low variability in contribution size.
    f.epfoContributionConsistency = clamp(
      onTimeFrac * (1 - Math.min(contribCv, 1)),
      0,
      1,
    );
  }

  // --- Obligations & Leverage ---------------------------------------------
  if (ob) {
    const avgInflow = mean([...monthlyCredits(txns).values()]);
    if (avgInflow > 0) {
      f.obligationToInflowRatio = clamp(
        safeDiv(ob.monthlyObligation, avgInflow, NEUTRAL_DEFAULTS.obligationToInflowRatio),
        0,
        3,
      );
    }
    f.obligationCount = ob.existingEmis;
  }

  return f;
}
