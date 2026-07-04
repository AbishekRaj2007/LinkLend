import jwt from "jsonwebtoken";
import { randomBytes, createHash } from "node:crypto";

// Access tokens are short-lived, stateless JWTs carried in an httpOnly cookie.
// Refresh tokens are long-lived, opaque, high-entropy values — only their
// SHA-256 hash is ever persisted (in the refresh_tokens table), so a leaked
// database never yields a usable token, and any refresh token can be revoked
// server-side (unlike a bare JWT, which is valid until it expires).
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60; // 15 minutes
export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function getAccessTokenSecret(): string {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) {
    throw new Error(
      "JWT_ACCESS_SECRET must be set. Did you forget to provision it?",
    );
  }
  return secret;
}

export interface AccessTokenPayload {
  userId: number;
}

export function signAccessToken(userId: number): string {
  const payload: AccessTokenPayload = { userId };
  return jwt.sign(payload, getAccessTokenSecret(), {
    algorithm: "HS256",
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload | null {
  try {
    const decoded = jwt.verify(token, getAccessTokenSecret(), {
      algorithms: ["HS256"],
    });
    const userId = (decoded as Record<string, unknown>)?.userId;
    return typeof userId === "number" ? { userId } : null;
  } catch {
    return null;
  }
}

export interface GeneratedRefreshToken {
  /** Opaque value sent to the client in a cookie — never stored as-is. */
  token: string;
  /** SHA-256 hex digest of `token` — what actually gets persisted. */
  tokenHash: string;
  expiresAt: Date;
}

export function generateRefreshToken(): GeneratedRefreshToken {
  const token = randomBytes(32).toString("hex");
  return {
    token,
    tokenHash: hashRefreshToken(token),
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
  };
}

export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
