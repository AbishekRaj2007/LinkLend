import { describe, it, expect, beforeAll } from "vitest";
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
  it("round-trips a userId through sign/verify", () => {
    const token = signAccessToken(42);
    expect(verifyAccessToken(token)).toEqual({ userId: 42 });
  });

  it("rejects a tampered token", () => {
    const token = signAccessToken(42);
    expect(verifyAccessToken(token + "tampered")).toBeNull();
  });

  it("rejects a token signed with a different secret", () => {
    const token = signAccessToken(42);
    const original = process.env.JWT_ACCESS_SECRET;
    process.env.JWT_ACCESS_SECRET = "a-different-secret";
    expect(verifyAccessToken(token)).toBeNull();
    process.env.JWT_ACCESS_SECRET = original;
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
