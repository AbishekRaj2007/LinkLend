import { describe, it, expect, beforeAll, vi } from "vitest";
import request from "supertest";
import { GenerateCardMemoResponse } from "@workspace/api-zod";

// Groq is mocked so the route logic (auth, persistence, idempotency) is tested
// without a live LLM call or a GROQ_API_KEY.
const MOCK_MEMO =
  "This MSME presents a moderate risk profile with steady cashflow and manageable leverage.";
vi.mock("../lib/groq", () => ({
  generateCreditMemo: vi.fn(async () => MOCK_MEMO),
}));

import { generateCreditMemo } from "../lib/groq";
import app from "../app";
import { signAccessToken } from "../lib/tokens";

const KNOWN_ID = "MSME-000004";
const NEVER_ASSESSED_ID = "MSME-001997";

beforeAll(() => {
  process.env.JWT_ACCESS_SECRET ??= "test-secret-do-not-use-in-production";
});

const lenderCookie = () => `access_token=${signAccessToken(1, "lender", null)}`;
const borrowerCookie = () =>
  `access_token=${signAccessToken(2, "borrower", KNOWN_ID)}`;

describe("POST /api/card/:msme_id/memo", () => {
  it("generates a memo once, persists it, and serves the cache on repeat calls", async () => {
    vi.mocked(generateCreditMemo).mockClear();

    // A fresh assessment gives a new score-history row with no memo yet.
    const assessed = await request(app)
      .post("/api/assess")
      .set("Cookie", lenderCookie())
      .send({ msme_id: KNOWN_ID });
    expect(assessed.status).toBe(200);

    const first = await request(app)
      .post(`/api/card/${KNOWN_ID}/memo`)
      .set("Cookie", lenderCookie());
    expect(first.status).toBe(200);
    expect(() => GenerateCardMemoResponse.parse(first.body)).not.toThrow();
    expect(first.body.memo).toBe(MOCK_MEMO);

    const second = await request(app)
      .post(`/api/card/${KNOWN_ID}/memo`)
      .set("Cookie", lenderCookie());
    expect(second.status).toBe(200);
    expect(second.body.memo).toBe(MOCK_MEMO);

    // Cached after the first generation — the LLM is called exactly once.
    expect(vi.mocked(generateCreditMemo)).toHaveBeenCalledTimes(1);
  });

  it("returns 404 when the MSME has never been assessed", async () => {
    const res = await request(app)
      .post(`/api/card/${NEVER_ASSESSED_ID}/memo`)
      .set("Cookie", lenderCookie());
    expect(res.status).toBe(404);
    expect(res.body.message.length).toBeGreaterThan(0);
  });

  it("returns 401 without a session", async () => {
    const res = await request(app).post(`/api/card/${KNOWN_ID}/memo`);
    expect(res.status).toBe(401);
  });

  it("returns 403 for a borrower session", async () => {
    const res = await request(app)
      .post(`/api/card/${KNOWN_ID}/memo`)
      .set("Cookie", borrowerCookie());
    expect(res.status).toBe(403);
  });
});
