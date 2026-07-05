import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { GetPortfolioResponse } from "@workspace/api-zod";
import app from "../app";
import { signAccessToken } from "../lib/tokens";

beforeAll(() => {
  process.env.JWT_ACCESS_SECRET ??= "test-secret-do-not-use-in-production";
});

const lenderCookie = () =>
  `access_token=${signAccessToken(1, "lender", null)}`;
const borrowerCookie = () =>
  `access_token=${signAccessToken(2, "borrower", "MSME-000001")}`;

describe("GET /api/portfolio", () => {
  // First hit pulls and scores every MSME (~175k child rows) to populate the
  // process-wide cache in data/store.ts — over a pooled remote connection
  // this alone can take well over vitest's default timeout.
  it(
    "returns a non-empty distribution and well-shaped analytics",
    async () => {
      const res = await request(app)
        .get("/api/portfolio")
        .set("Cookie", lenderCookie());

      expect(res.status).toBe(200);
      expect(() => GetPortfolioResponse.parse(res.body)).not.toThrow();

      expect(res.body.scoreDistribution.length).toBeGreaterThan(0);
      const totalCount = res.body.scoreDistribution.reduce(
        (s: number, b: { count: number }) => s + b.count,
        0,
      );
      expect(totalCount).toBeGreaterThan(0);

      expect(res.body.sectorConcentration.length).toBeGreaterThan(0);
      for (const s of res.body.sectorConcentration) {
        expect(s.count).toBeGreaterThan(0);
        expect(s.avgScore).toBeGreaterThanOrEqual(0);
        expect(s.avgScore).toBeLessThanOrEqual(100);
      }

      expect(res.body.expectedDefaultEstimate).toBeGreaterThanOrEqual(0);
      expect(res.body.expectedDefaultEstimate).toBeLessThanOrEqual(1);
    },
    180_000,
  );

  it("returns 401 without a session", async () => {
    const res = await request(app).get("/api/portfolio");
    expect(res.status).toBe(401);
  });

  it("returns 403 for a borrower session", async () => {
    const res = await request(app)
      .get("/api/portfolio")
      .set("Cookie", borrowerCookie());
    expect(res.status).toBe(403);
  });
});
