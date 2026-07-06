// Domain record types consumed by feature engineering and scoring. These are
// deliberately decoupled from the Drizzle row types so the scoring core stays
// pure and DB-independent: it can be fed rows read from Postgres (data/store.ts)
// or rows produced in-memory by the synthetic generator (synthetic/generate.ts).

export interface MsmeMasterRecord {
  msmeId: string;
  udyamId: string;
  gstin: string;
  sector: string;
  region: string;
  vintageMonths: number;
  ntcNtbFlag: boolean;
  /** Ground-truth creditworthiness in [0,1] — synthetic only, never scored on. */
  latentHealth: number;
  /** 1 == repaid / non-default, 0 == default. */
  outcomeLabel: number;
}

export interface GstReturnRecord {
  period: string; // "YYYY-MM"
  turnover: number;
  taxPaid: number;
  invoiceCount: number;
  filingDate: string | null; // null == never filed
  dueDate: string;
}

export interface TransactionRecord {
  date: string; // "YYYY-MM-DD"
  amount: number; // always positive; sign carried by `direction`
  direction: "credit" | "debit";
  counterpartyType: string;
  category: string;
  runningBalance: number;
}

export interface EpfoRecord {
  period: string; // "YYYY-MM"
  employeeCount: number;
  contributionAmount: number;
  paidOnTime: boolean;
}

export interface ObligationRecord {
  existingEmis: number;
  monthlyObligation: number;
  bounceCount: number;
}

/** Everything the scorer needs about one MSME, bundled per source. */
export interface MsmeBundle {
  master: MsmeMasterRecord;
  gst: GstReturnRecord[];
  transactions: TransactionRecord[];
  epfo: EpfoRecord[];
  obligation: ObligationRecord | null;
}
