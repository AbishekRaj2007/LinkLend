import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../lib/tokens";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { id: number };
    }
  }
}

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const token = req.cookies?.access_token as string | undefined;
  const payload = token ? verifyAccessToken(token) : null;

  if (!payload) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }

  req.user = { id: payload.userId };
  next();
}
