import { describe, it, expect } from "vitest";
import request from "supertest";
import { GetPortfolioResponse } from "@workspace/api-zod";
import app from "../app";

describe("GET /api/portfolio", () => {
  it("returns a non-empty distribution and well-shaped analytics", async () => {
    const res = await request(app).get("/api/portfolio");

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
  });
});
