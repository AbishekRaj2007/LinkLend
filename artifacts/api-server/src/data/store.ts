// Reads MSME data out of Postgres and maps it into the DB-independent MsmeBundle
// the scoring core consumes. Importing this module pulls in @workspace/db, which
// requires DATABASE_URL — so only the live API route (not the scoring core or the
// training/validation scripts) depends on it.

import { eq } from "drizzle-orm";
import {
  db,
  msmeMaster,
  gstReturns,
  transactions,
  epfo,
  obligations,
} from "@workspace/db";
import type {
  MsmeBundle,
  MsmeMasterRecord,
  GstReturnRecord,
  TransactionRecord,
  EpfoRecord,
  ObligationRecord,
} from "../types";

export async function listMsmeIds(): Promise<string[]> {
  const rows = await db.select({ msmeId: msmeMaster.msmeId }).from(msmeMaster);
  return rows.map((r) => r.msmeId);
}

export async function loadBundle(msmeId: string): Promise<MsmeBundle | null> {
  const masterRows = await db
    .select()
    .from(msmeMaster)
    .where(eq(msmeMaster.msmeId, msmeId));
  const m = masterRows[0];
  if (!m) return null;

  const master: MsmeMasterRecord = {
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

  return { master, gst, transactions: txns, epfo: epfoRecs, obligation };
}
