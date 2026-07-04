// Export your models here. Add one export per file
// export * from "./posts";
//
// Each model/table should ideally be split into different files.
// Each model/table should define a Drizzle table, insert schema, and types:
//
//   import { pgTable, text, serial } from "drizzle-orm/pg-core";
//   import { createInsertSchema } from "drizzle-zod";
//   import { z } from "zod/v4";
//
//   export const postsTable = pgTable("posts", {
//     id: serial("id").primaryKey(),
//     title: text("title").notNull(),
//   });
//
//   export const insertPostSchema = createInsertSchema(postsTable).omit({ id: true });
//   export type InsertPost = z.infer<typeof insertPostSchema>;
//   export type Post = typeof postsTable.$inferSelect;

import {
  pgTable,
  text,
  serial,
  integer,
  boolean,
  real,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ---------------------------------------------------------------------------
// msme_master
// ---------------------------------------------------------------------------
export const msmeMaster = pgTable("msme_master", {
  id: serial("id").primaryKey(),
  msmeId: text("msme_id").notNull().unique(),
  udyamId: text("udyam_id").notNull(),
  gstin: text("gstin").notNull(),
  sector: text("sector").notNull(),
  region: text("region").notNull(),
  vintageMonths: integer("vintage_months").notNull(),
  ntcNtbFlag: boolean("ntc_ntb_flag").notNull(),
  latentHealth: real("latent_health").notNull(),
  outcomeLabel: integer("outcome_label").notNull(),
});

export const insertMsmeMasterSchema = createInsertSchema(msmeMaster).omit({
  id: true,
});
export type InsertMsmeMaster = z.infer<typeof insertMsmeMasterSchema>;
export type MsmeMaster = typeof msmeMaster.$inferSelect;

// ---------------------------------------------------------------------------
// gst_returns
// ---------------------------------------------------------------------------
export const gstReturns = pgTable("gst_returns", {
  id: serial("id").primaryKey(),
  // fk-by-value to msme_master.msme_id
  msmeId: text("msme_id").notNull(),
  period: text("period").notNull(),
  turnover: real("turnover").notNull(),
  taxPaid: real("tax_paid").notNull(),
  invoiceCount: integer("invoice_count").notNull(),
  filingDate: text("filing_date"),
  dueDate: text("due_date").notNull(),
});

export const insertGstReturnsSchema = createInsertSchema(gstReturns).omit({
  id: true,
});
export type InsertGstReturns = z.infer<typeof insertGstReturnsSchema>;
export type GstReturns = typeof gstReturns.$inferSelect;

// ---------------------------------------------------------------------------
// transactions
// ---------------------------------------------------------------------------
export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  msmeId: text("msme_id").notNull(),
  date: text("date").notNull(),
  amount: real("amount").notNull(),
  direction: text("direction").notNull(),
  counterpartyType: text("counterparty_type").notNull(),
  category: text("category").notNull(),
  runningBalance: real("running_balance").notNull(),
});

export const insertTransactionsSchema = createInsertSchema(transactions).omit({
  id: true,
});
export type InsertTransactions = z.infer<typeof insertTransactionsSchema>;
export type Transactions = typeof transactions.$inferSelect;

// ---------------------------------------------------------------------------
// epfo
// ---------------------------------------------------------------------------
export const epfo = pgTable("epfo", {
  id: serial("id").primaryKey(),
  msmeId: text("msme_id").notNull(),
  period: text("period").notNull(),
  employeeCount: integer("employee_count").notNull(),
  contributionAmount: real("contribution_amount").notNull(),
  paidOnTime: boolean("paid_on_time").notNull(),
});

export const insertEpfoSchema = createInsertSchema(epfo).omit({ id: true });
export type InsertEpfo = z.infer<typeof insertEpfoSchema>;
export type Epfo = typeof epfo.$inferSelect;

// ---------------------------------------------------------------------------
// obligations
// ---------------------------------------------------------------------------
export const obligations = pgTable("obligations", {
  id: serial("id").primaryKey(),
  msmeId: text("msme_id").notNull(),
  existingEmis: integer("existing_emis").notNull(),
  monthlyObligation: real("monthly_obligation").notNull(),
  bounceCount: integer("bounce_count").notNull(),
});

export const insertObligationsSchema = createInsertSchema(obligations).omit({
  id: true,
});
export type InsertObligations = z.infer<typeof insertObligationsSchema>;
export type Obligations = typeof obligations.$inferSelect;

// ---------------------------------------------------------------------------
// msme_credit_scores
// ---------------------------------------------------------------------------
export const msmeCreditScores = pgTable("msme_credit_scores", {
  id: serial("id").primaryKey(),
  // fk-by-value to msme_master.msme_id
  msmeId: text("msme_id").notNull(),
  cmrRank: integer("cmr_rank").notNull(),
  cibilScore: integer("cibil_score").notNull(),
  creditUtilizationPct: real("credit_utilization_pct").notNull(),
  riskCategory: text("risk_category").notNull(),
  flags: text("flags").array().notNull(),
});

export const insertMsmeCreditScoresSchema = createInsertSchema(
  msmeCreditScores,
).omit({ id: true });
export type InsertMsmeCreditScores = z.infer<
  typeof insertMsmeCreditScoresSchema
>;
export type MsmeCreditScores = typeof msmeCreditScores.$inferSelect;

// ---------------------------------------------------------------------------
// users
// ---------------------------------------------------------------------------
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// ---------------------------------------------------------------------------
// refresh_tokens
// ---------------------------------------------------------------------------
export const refreshTokens = pgTable("refresh_tokens", {
  id: serial("id").primaryKey(),
  // fk-by-value to users.id
  userId: integer("user_id").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertRefreshTokenSchema = createInsertSchema(
  refreshTokens,
).omit({ id: true, createdAt: true, revokedAt: true });
export type InsertRefreshToken = z.infer<typeof insertRefreshTokenSchema>;
export type RefreshToken = typeof refreshTokens.$inferSelect;
