import { describe, it, expect } from "vitest";
import { getTableColumns } from "drizzle-orm";
import {
  msmeMaster,
  gstReturns,
  transactions,
  epfo,
  obligations,
  msmeCreditScores,
  msmeScoreHistory,
  users,
  refreshTokens,
  insertMsmeMasterSchema,
  insertGstReturnsSchema,
  insertTransactionsSchema,
  insertEpfoSchema,
  insertObligationsSchema,
  insertMsmeCreditScoresSchema,
  insertMsmeScoreHistorySchema,
  insertUserSchema,
  insertRefreshTokenSchema,
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
    {
      name: "msme_credit_scores",
      table: msmeCreditScores,
      columns: [
        "id",
        "msmeId",
        "cmrRank",
        "cibilScore",
        "creditUtilizationPct",
        "riskCategory",
        "flags",
      ],
    },
    {
      name: "msme_score_history",
      table: msmeScoreHistory,
      columns: [
        "id",
        "msmeId",
        "overallScore",
        "ratingBand",
        "pillars",
        "confidence",
        "repayment",
        "flags",
        "forecast",
        "assessedByUserId",
        "memo",
        "createdAt",
      ],
    },
    {
      name: "users",
      table: users,
      columns: [
        "id",
        "email",
        "passwordHash",
        "name",
        "role",
        "msmeId",
        "createdAt",
      ],
    },
    {
      name: "refresh_tokens",
      table: refreshTokens,
      columns: [
        "id",
        "userId",
        "tokenHash",
        "expiresAt",
        "revokedAt",
        "createdAt",
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

  it("insertMsmeCreditScoresSchema parses a valid row and rejects a missing required field", () => {
    const valid = {
      msmeId: "MSME-0001",
      cmrRank: 4,
      cibilScore: 690,
      creditUtilizationPct: 35.5,
      riskCategory: "Moderate Risk",
      flags: ["high_utilization", "low_cibil_score"],
    };
    expect(insertMsmeCreditScoresSchema.parse(valid)).toEqual(valid);

    const { cibilScore: _omit, ...missing } = valid;
    expect(insertMsmeCreditScoresSchema.safeParse(missing).success).toBe(
      false,
    );
  });

  it("insertMsmeScoreHistorySchema parses a valid row and rejects a missing required field", () => {
    const valid = {
      msmeId: "MSME-0001",
      overallScore: 72,
      ratingBand: "Moderate Risk",
      pillars: [{ name: "Business Vitality", score: 68, reasons: ["Steady turnover"] }],
      confidence: { level: "High", raise_by: "" },
      repayment: { sustainable_emi: 45000, basis: "30% of net inflow" },
      flags: { consistency_alert: false, detail: "No material inconsistencies." },
      forecast: { months: ["2026-07"], projected_net_surplus: [120000] },
      assessedByUserId: 1,
    };
    expect(insertMsmeScoreHistorySchema.parse(valid)).toEqual(valid);

    const { overallScore: _omit, ...missing } = valid;
    expect(insertMsmeScoreHistorySchema.safeParse(missing).success).toBe(false);
  });

  it("insertUserSchema parses a valid row and rejects a missing required field", () => {
    const valid = {
      email: "analyst@example.com",
      passwordHash: "$2b$12$abcdefghijklmnopqrstuv",
      name: "Priya Nair",
      role: "lender",
    };
    expect(insertUserSchema.parse(valid)).toEqual(valid);

    const { email: _omit, ...missing } = valid;
    expect(insertUserSchema.safeParse(missing).success).toBe(false);
  });

  it("insertUserSchema allows role to be omitted, falling back to the column default", () => {
    const valid = {
      email: "no-role@example.com",
      passwordHash: "$2b$12$abcdefghijklmnopqrstuv",
      name: "No Role",
    };
    expect(insertUserSchema.safeParse(valid).success).toBe(true);
  });

  it("insertUserSchema parses a borrower row with a linked msmeId", () => {
    const valid = {
      email: "borrower@example.com",
      passwordHash: "$2b$12$abcdefghijklmnopqrstuv",
      name: "Priya Nair",
      role: "borrower",
      msmeId: "MSME-000001",
    };
    expect(insertUserSchema.parse(valid)).toEqual(valid);
  });

  it("insertRefreshTokenSchema parses a valid row and rejects a missing required field", () => {
    const valid = {
      userId: 1,
      tokenHash: "a".repeat(64),
      expiresAt: new Date("2026-08-01T00:00:00Z"),
    };
    expect(insertRefreshTokenSchema.parse(valid)).toEqual(valid);

    const { tokenHash: _omit, ...missing } = valid;
    expect(insertRefreshTokenSchema.safeParse(missing).success).toBe(false);
  });
});
