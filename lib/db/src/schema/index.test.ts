import { describe, it, expect } from "vitest";
import { getTableColumns } from "drizzle-orm";
import {
  msmeMaster,
  gstReturns,
  transactions,
  epfo,
  obligations,
  insertMsmeMasterSchema,
  insertGstReturnsSchema,
  insertTransactionsSchema,
  insertEpfoSchema,
  insertObligationsSchema,
} from "./index";

describe("schema tables", () => {
  const cases = [
    {
      name: "msme_master",
      table: msmeMaster,
      columns: [
        "id",
        "msmeId",
        "udyamId",
        "gstin",
        "sector",
        "region",
        "vintageMonths",
        "ntcNtbFlag",
        "latentHealth",
        "outcomeLabel",
      ],
    },
    {
      name: "gst_returns",
      table: gstReturns,
      columns: [
        "id",
        "msmeId",
        "period",
        "turnover",
        "taxPaid",
        "invoiceCount",
        "filingDate",
        "dueDate",
      ],
    },
    {
      name: "transactions",
      table: transactions,
      columns: [
        "id",
        "msmeId",
        "date",
        "amount",
        "direction",
        "counterpartyType",
        "category",
        "runningBalance",
      ],
    },
    {
      name: "epfo",
      table: epfo,
      columns: [
        "id",
        "msmeId",
        "period",
        "employeeCount",
        "contributionAmount",
        "paidOnTime",
      ],
    },
    {
      name: "obligations",
      table: obligations,
      columns: [
        "id",
        "msmeId",
        "existingEmis",
        "monthlyObligation",
        "bounceCount",
      ],
    },
  ] as const;

  it.each(cases)("$name is a valid Drizzle table", ({ table, columns }) => {
    const cols = getTableColumns(table);
    expect(Object.keys(cols).sort()).toEqual([...columns].sort());
  });
});

describe("insert schemas", () => {
  it("insertMsmeMasterSchema parses a valid row and rejects a missing required field", () => {
    const valid = {
      msmeId: "MSME-0001",
      udyamId: "UDYAM-KA-01-0000001",
      gstin: "29ABCDE1234F1Z5",
      sector: "manufacturing",
      region: "south",
      vintageMonths: 36,
      ntcNtbFlag: false,
      latentHealth: 0.72,
      outcomeLabel: 0,
    };
    expect(insertMsmeMasterSchema.parse(valid)).toEqual(valid);

    const { msmeId: _omit, ...missing } = valid;
    expect(insertMsmeMasterSchema.safeParse(missing).success).toBe(false);
  });

  it("insertGstReturnsSchema parses a valid row and rejects a missing required field", () => {
    const valid = {
      msmeId: "MSME-0001",
      period: "2026-01",
      turnover: 125000.5,
      taxPaid: 22500.09,
      invoiceCount: 42,
      filingDate: "2026-02-10",
      dueDate: "2026-02-11",
    };
    expect(insertGstReturnsSchema.parse(valid)).toEqual(valid);

    const { turnover: _omit, ...missing } = valid;
    expect(insertGstReturnsSchema.safeParse(missing).success).toBe(false);
  });

  it("insertTransactionsSchema parses a valid row and rejects a missing required field", () => {
    const valid = {
      msmeId: "MSME-0001",
      date: "2026-01-15",
      amount: 5000,
      direction: "credit",
      counterpartyType: "customer",
      category: "sales",
      runningBalance: 105000,
    };
    expect(insertTransactionsSchema.parse(valid)).toEqual(valid);

    const { amount: _omit, ...missing } = valid;
    expect(insertTransactionsSchema.safeParse(missing).success).toBe(false);
  });

  it("insertEpfoSchema parses a valid row and rejects a missing required field", () => {
    const valid = {
      msmeId: "MSME-0001",
      period: "2026-01",
      employeeCount: 12,
      contributionAmount: 18000,
      paidOnTime: true,
    };
    expect(insertEpfoSchema.parse(valid)).toEqual(valid);

    const { employeeCount: _omit, ...missing } = valid;
    expect(insertEpfoSchema.safeParse(missing).success).toBe(false);
  });

  it("insertObligationsSchema parses a valid row and rejects a missing required field", () => {
    const valid = {
      msmeId: "MSME-0001",
      existingEmis: 2,
      monthlyObligation: 15000,
      bounceCount: 0,
    };
    expect(insertObligationsSchema.parse(valid)).toEqual(valid);

    const { monthlyObligation: _omit, ...missing } = valid;
    expect(insertObligationsSchema.safeParse(missing).success).toBe(false);
  });
});
