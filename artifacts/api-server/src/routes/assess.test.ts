import { describe, it, expect } from "vitest";
import request from "supertest";
import { AssessResponse } from "@workspace/api-zod";
import app from "../app";

const KNOWN_ID = "MSME-000001";
const UNKNOWN_ID = "MSME-999999";

describe("POST /api/assess", () => {
  it("returns 200 with a schema-valid card for a known msme_id", async () => {
    const res = await request(app).post("/api/assess").send({ msme_id: KNOWN_ID });

    expect(res.status).toBe(200);
    expect(res.body.msme_id).toBe(KNOWN_ID);
    // The response conforms to the generated contract exactly.
    expect(() => AssessResponse.parse(res.body)).not.toThrow();
    expect(res.body.pillars).toHaveLength(5);
    expect(res.body.forecast.months.length).toBeGreaterThanOrEqual(3);
  });

  it("returns 400 when msme_id is missing", async () => {
    const res = await request(app).post("/api/assess").send({});
    expect(res.status).toBe(400);
    expect(res.body.error.length).toBeGreaterThan(0);
  });

  it("returns 404 for an unknown msme_id", async () => {
    const res = await request(app)
      .post("/api/assess")
      .send({ msme_id: UNKNOWN_ID });
    expect(res.status).toBe(404);
    expect(res.body.error.length).toBeGreaterThan(0);
  });
});
