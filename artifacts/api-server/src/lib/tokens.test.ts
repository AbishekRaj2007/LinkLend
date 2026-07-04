import { describe, it, expect, beforeAll } from "vitest";
import jwt from "jsonwebtoken";
import {
  signAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  hashRefreshToken,
} from "./tokens";

beforeAll(() => {
  process.env.JWT_ACCESS_SECRET = "test-secret-do-not-use-in-production";
});

describe("access tokens", () => {
  it("round-trips a lender's userId/role/msmeId through sign/verify", () => {
    const token = signAccessToken(42, "lender", null);
    expect(verifyAccessToken(token)).toEqual({
      userId: 42,
      role: "lender",
      msmeId: null,
    });
  });

  it("round-trips a borrower's linked msmeId through sign/verify", () => {
    const token = signAccessToken(7, "borrower", "MSME-000001");
    expect(verifyAccessToken(token)).toEqual({
      userId: 7,
      role: "borrower",
      msmeId: "MSME-000001",
    });
  });

  it("rejects a tampered token", () => {
    const token = signAccessToken(42, "lender", null);
    expect(verifyAccessToken(token + "tampered")).toBeNull();
  });

  it("rejects a token signed with a different secret", () => {
    const token = signAccessToken(42, "lender", null);
    const original = process.env.JWT_ACCESS_SECRET;
    process.env.JWT_ACCESS_SECRET = "a-different-secret";
    expect(verifyAccessToken(token)).toBeNull();
    process.env.JWT_ACCESS_SECRET = original;
  });

  it("rejects a token with an invalid role claim", () => {
    const bogus = jwt.sign(
      { userId: 42, role: "admin", msmeId: null },
      process.env.JWT_ACCESS_SECRET!,
      { algorithm: "HS256", expiresIn: 900 },
    );
    expect(verifyAccessToken(bogus)).toBeNull();
  });
});

describe("refresh tokens", () => {
  it("generates a high-entropy opaque token whose hash matches hashRefreshToken", () => {
    const generated = generateRefreshToken();
    expect(generated.token).toHaveLength(64); // 32 bytes, hex-encoded
    expect(generated.tokenHash).toBe(hashRefreshToken(generated.token));
    expect(generated.tokenHash).not.toBe(generated.token);
  });

  it("sets an expiry roughly 7 days out", () => {
    const generated = generateRefreshToken();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const delta = generated.expiresAt.getTime() - Date.now();
    expect(delta).toBeGreaterThan(sevenDaysMs - 5000);
    expect(delta).toBeLessThanOrEqual(sevenDaysMs);
  });

  it("generates a different token every call", () => {
    const a = generateRefreshToken();
    const b = generateRefreshToken();
    expect(a.token).not.toBe(b.token);
  });
});
