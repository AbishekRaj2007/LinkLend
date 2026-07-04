import { Router, type IRouter, type Response } from "express";
import rateLimit from "express-rate-limit";
import { eq } from "drizzle-orm";
import { db, users, refreshTokens } from "@workspace/db";
import {
  SignupBody,
  SignupResponse,
  LoginBody,
  LoginResponse,
  RefreshResponse,
  MeResponse,
} from "@workspace/api-zod";
import { hashPassword, verifyPassword } from "../lib/password";
import {
  signAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_MS,
} from "../lib/tokens";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

// Applied only to the credential-guessing surface (signup/login), not to
// every /auth/* route.
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts, please try again later." },
});

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function setAuthCookies(
  res: Response,
  accessToken: string,
  refreshToken: string,
): void {
  const isProd = process.env.NODE_ENV === "production";
  res.cookie("access_token", accessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: ACCESS_TOKEN_TTL_SECONDS * 1000,
  });
  res.cookie("refresh_token", refreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: REFRESH_TOKEN_TTL_MS,
  });
}

function clearAuthCookies(res: Response): void {
  res.clearCookie("access_token", { path: "/" });
  res.clearCookie("refresh_token", { path: "/" });
}

async function issueSession(
  res: Response,
  userId: number,
): Promise<void> {
  const accessToken = signAccessToken(userId);
  const refresh = generateRefreshToken();

  await db.insert(refreshTokens).values({
    userId,
    tokenHash: refresh.tokenHash,
    expiresAt: refresh.expiresAt,
  });

  setAuthCookies(res, accessToken, refresh.token);
}

router.post("/auth/signup", authRateLimiter, async (req, res) => {
  const parsed = SignupBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      message: parsed.error.issues[0]?.message ?? "Invalid signup payload",
    });
    return;
  }

  const email = normalizeEmail(parsed.data.email);
  const { password, name } = parsed.data;

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing.length > 0) {
    res
      .status(409)
      .json({ message: "An account with this email already exists" });
    return;
  }

  const passwordHash = await hashPassword(password);
  const [user] = await db
    .insert(users)
    .values({ email, passwordHash, name })
    .returning();

  await issueSession(res, user.id);

  res
    .status(201)
    .json(
      SignupResponse.parse({
        user: { id: user.id, email: user.email, name: user.name },
      }),
    );
});

router.post("/auth/login", authRateLimiter, async (req, res) => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(401).json({ message: "Invalid email or password" });
    return;
  }

  const email = normalizeEmail(parsed.data.email);
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  const passwordOk = user
    ? await verifyPassword(parsed.data.password, user.passwordHash)
    : false;

  if (!user || !passwordOk) {
    res.status(401).json({ message: "Invalid email or password" });
    return;
  }

  await issueSession(res, user.id);

  res.json(
    LoginResponse.parse({
      user: { id: user.id, email: user.email, name: user.name },
    }),
  );
});

router.post("/auth/refresh", async (req, res) => {
  const token = req.cookies?.refresh_token as string | undefined;
  if (!token) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }

  const tokenHash = hashRefreshToken(token);
  const [stored] = await db
    .select()
    .from(refreshTokens)
    .where(eq(refreshTokens.tokenHash, tokenHash))
    .limit(1);

  const isValid =
    stored && !stored.revokedAt && stored.expiresAt.getTime() > Date.now();

  if (!stored || !isValid) {
    clearAuthCookies(res);
    res
      .status(401)
      .json({ message: "Session expired, please log in again" });
    return;
  }

  // Rotate: revoke the used refresh token so it can never be replayed.
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(eq(refreshTokens.id, stored.id));

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, stored.userId))
    .limit(1);

  if (!user) {
    clearAuthCookies(res);
    res.status(401).json({ message: "Not authenticated" });
    return;
  }

  await issueSession(res, user.id);

  res.json(
    RefreshResponse.parse({
      user: { id: user.id, email: user.email, name: user.name },
    }),
  );
});

router.post("/auth/logout", async (req, res) => {
  const token = req.cookies?.refresh_token as string | undefined;
  if (token) {
    const tokenHash = hashRefreshToken(token);
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.tokenHash, tokenHash));
  }

  clearAuthCookies(res);
  res.status(204).end();
});

router.get("/auth/me", requireAuth, async (req, res) => {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, req.user!.id))
    .limit(1);

  if (!user) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }

  res.json(
    MeResponse.parse({
      user: { id: user.id, email: user.email, name: user.name },
    }),
  );
});

export default router;
