import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { GetCardResponse, GetCardHistoryResponse } from "@workspace/api-zod";
import app from "../app";
import { signAccessToken } from "../lib/tokens";

const KNOWN_ID = "MSME-000002";

beforeAll(() => {
  process.env.JWT_ACCESS_SECRET ??= "test-secret-do-not-use-in-production";
});

const lenderCookie = () =>
  `access_token=${signAccessToken(1, "lender", null)}`;
const borrowerCookie = () =>
  `access_token=${signAccessToken(2, "borrower", KNOWN_ID)}`;

describe("GET /api/card/:msme_id", () => {
  it("returns the cached result from a prior /assess", async () => {
    const assessed = await request(app)
      .post("/api/assess")
      .set("Cookie", lenderCookie())
      .send({ msme_id: KNOWN_ID });
    expect(assessed.status).toBe(200);

    const res = await request(app)
      .get(`/api/card/${KNOWN_ID}`)
      .set("Cookie", lenderCookie());
    expect(res.status).toBe(200);
    expect(res.body.msme_id).toBe(KNOWN_ID);
    expect(() => GetCardResponse.parse(res.body)).not.toThrow();
    // Same card that /assess produced.
    expect(res.body.overall_score).toBe(assessed.body.overall_score);
  });

  it("returns 404 when the MSME has not been assessed yet", async () => {
    const res = await request(app)
      .get("/api/card/MSME-000999")
      .set("Cookie", lenderCookie());
    expect(res.status).toBe(404);
    expect(res.body.message.length).toBeGreaterThan(0);
  });

  it("returns 401 without a session", async () => {
    const res = await request(app).get(`/api/card/${KNOWN_ID}`);
    expect(res.status).toBe(401);
  });

  it("returns 403 for a borrower session", async () => {
    const res = await request(app)
      .get(`/api/card/${KNOWN_ID}`)
      .set("Cookie", borrowerCookie());
    expect(res.status).toBe(403);
  });
});

describe("GET /api/card/:msme_id/history", () => {
  it("records a history entry on /assess and returns it, newest data reflecting that score", async () => {
    const assessed = await request(app)
      .post("/api/assess")
      .set("Cookie", lenderCookie())
      .send({ msme_id: KNOWN_ID });
    expect(assessed.status).toBe(200);

    const res = await request(app)
      .get(`/api/card/${KNOWN_ID}/history`)
      .set("Cookie", lenderCookie());

    expect(res.status).toBe(200);
    expect(() => GetCardHistoryResponse.parse(res.body)).not.toThrow();
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);

    for (const entry of res.body) {
      expect(entry.msme_id).toBe(KNOWN_ID);
    }
    // History is oldest-first, so the last entry is the assessment we just ran.
    const latest = res.body[res.body.length - 1];
    expect(latest.overall_score).toBe(assessed.body.overall_score);
  });

  it("returns an empty array for an MSME that was never assessed", async () => {
    const res = await request(app)
      .get("/api/card/MSME-001999/history")
      .set("Cookie", lenderCookie());
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns 401 without a session", async () => {
    const res = await request(app).get(`/api/card/${KNOWN_ID}/history`);
    expect(res.status).toBe(401);
  });

  it("returns 403 for a borrower session", async () => {
    const res = await request(app)
      .get(`/api/card/${KNOWN_ID}/history`)
      .set("Cookie", borrowerCookie());
    expect(res.status).toBe(403);
  });
});
