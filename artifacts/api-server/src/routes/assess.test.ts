import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { AssessResponse } from "@workspace/api-zod";
import app from "../app";
import { signAccessToken } from "../lib/tokens";

const KNOWN_ID = "MSME-000001";
const UNKNOWN_ID = "MSME-999999";

beforeAll(() => {
  process.env.JWT_ACCESS_SECRET ??= "test-secret-do-not-use-in-production";
});

const lenderCookie = () =>
  `access_token=${signAccessToken(1, "lender", null)}`;
const borrowerCookie = () =>
  `access_token=${signAccessToken(2, "borrower", KNOWN_ID)}`;

describe("POST /api/assess", () => {
  it("returns 200 with a schema-valid card for a known msme_id", async () => {
    const res = await request(app)
      .post("/api/assess")
      .set("Cookie", lenderCookie())
      .send({ msme_id: KNOWN_ID });

    expect(res.status).toBe(200);
    expect(res.body.msme_id).toBe(KNOWN_ID);
    // The response conforms to the generated contract exactly.
    expect(() => AssessResponse.parse(res.body)).not.toThrow();
    expect(res.body.pillars).toHaveLength(5);
    expect(res.body.forecast.months.length).toBeGreaterThanOrEqual(3);
  });

  it("returns 400 when msme_id is missing", async () => {
    const res = await request(app)
      .post("/api/assess")
      .set("Cookie", lenderCookie())
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.message.length).toBeGreaterThan(0);
  });

  it("returns 404 for an unknown msme_id", async () => {
    const res = await request(app)
      .post("/api/assess")
      .set("Cookie", lenderCookie())
      .send({ msme_id: UNKNOWN_ID });
    expect(res.status).toBe(404);
    expect(res.body.message.length).toBeGreaterThan(0);
  });

  it("returns 401 without a session", async () => {
    const res = await request(app).post("/api/assess").send({ msme_id: KNOWN_ID });
    expect(res.status).toBe(401);
  });

  it("returns 403 for a borrower session", async () => {
    const res = await request(app)
      .post("/api/assess")
      .set("Cookie", borrowerCookie())
      .send({ msme_id: KNOWN_ID });
    expect(res.status).toBe(403);
  });
});
