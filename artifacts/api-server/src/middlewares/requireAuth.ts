import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken, type UserRole } from "../lib/tokens";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { id: number; role: UserRole; msmeId: string | null };
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

  req.user = { id: payload.userId, role: payload.role, msmeId: payload.msmeId };
  next();
}

/** Restricts a route to a single role. Must run after `requireAuth`. */
export function requireRole(role: UserRole) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ message: "Not authenticated" });
      return;
    }
    if (req.user.role !== role) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    next();
  };
}
