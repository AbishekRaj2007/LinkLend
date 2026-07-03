import { describe, it, expect } from "vitest";
import request from "supertest";
import { GetCardResponse } from "@workspace/api-zod";
import app from "../app";

const KNOWN_ID = "MSME-000002";

describe("GET /api/card/:msme_id", () => {
  it("returns the cached result from a prior /assess", async () => {
    const assessed = await request(app)
      .post("/api/assess")
      .send({ msme_id: KNOWN_ID });
    expect(assessed.status).toBe(200);

    const res = await request(app).get(`/api/card/${KNOWN_ID}`);
    expect(res.status).toBe(200);
    expect(res.body.msme_id).toBe(KNOWN_ID);
    expect(() => GetCardResponse.parse(res.body)).not.toThrow();
    // Same card that /assess produced.
    expect(res.body.overall_score).toBe(assessed.body.overall_score);
  });

  it("returns 404 when the MSME has not been assessed yet", async () => {
    const res = await request(app).get("/api/card/MSME-000999");
    expect(res.status).toBe(404);
    expect(res.body.error.length).toBeGreaterThan(0);
  });
});
