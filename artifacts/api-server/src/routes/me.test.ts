import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { GetMyScorecardResponse } from "@workspace/api-zod";
import app from "../app";
import { signAccessToken } from "../lib/tokens";

const KNOWN_ID = "MSME-000003";

beforeAll(() => {
  process.env.JWT_ACCESS_SECRET ??= "test-secret-do-not-use-in-production";
});

const lenderCookie = () =>
  `access_token=${signAccessToken(1, "lender", null)}`;
const borrowerCookie = (msmeId: string | null) =>
  `access_token=${signAccessToken(2, "borrower", msmeId)}`;

describe("GET /api/me/scorecard", () => {
  it("returns 401 without a session", async () => {
    const res = await request(app).get("/api/me/scorecard");
    expect(res.status).toBe(401);
  });

  it("returns 403 for a lender session", async () => {
    const res = await request(app)
      .get("/api/me/scorecard")
      .set("Cookie", lenderCookie());
    expect(res.status).toBe(403);
  });

  it("returns 200 with a schema-valid card for the borrower's linked msmeId", async () => {
    const res = await request(app)
      .get("/api/me/scorecard")
      .set("Cookie", borrowerCookie(KNOWN_ID));

    expect(res.status).toBe(200);
    expect(res.body.msme_id).toBe(KNOWN_ID);
    expect(() => GetMyScorecardResponse.parse(res.body)).not.toThrow();
  });

  it("returns 404 for a borrower whose linked msmeId is unknown", async () => {
    const res = await request(app)
      .get("/api/me/scorecard")
      .set("Cookie", borrowerCookie("MSME-999999"));
    expect(res.status).toBe(404);
  });
});
