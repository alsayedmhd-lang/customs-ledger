import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "atw-customs-secret-2026";

export interface AuthPayload {
  userId: number;
  username: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const isCustomerLedger = req.originalUrl.includes("customer-ledger");
  const header = req.headers.authorization;
  if (isCustomerLedger) {
    console.log("[customer-ledger trace] requireAuth entered", {
      method: req.method,
      originalUrl: req.originalUrl,
      path: req.path,
      hasToken: Boolean(header?.startsWith("Bearer ")),
    });
  }
  if (!header?.startsWith("Bearer ")) {
    if (isCustomerLedger) {
      console.log("[customer-ledger trace] requireAuth denied", {
        reason: "missing_bearer_token",
        status: 401,
      });
    }
    return res.status(401).json({ message: "غير مصرح — الرجاء تسجيل الدخول" });
  }
  try {
    const token = header.slice(7);
    req.user = jwt.verify(token, JWT_SECRET) as AuthPayload;
    if (isCustomerLedger) {
      console.log("[customer-ledger trace] requireAuth success", {
        user: req.user,
      });
    }
    next();
  } catch (err) {
    if (isCustomerLedger) {
      console.log("[customer-ledger trace] requireAuth denied", {
        reason: "token_verify_failed",
        status: 401,
        error: err instanceof Error ? err.message : String(err),
      });
    }
    return res.status(401).json({ message: "انتهت صلاحية الجلسة — الرجاء تسجيل الدخول مجدداً" });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  requireAuth(req, res, () => {
    if (req.user?.role !== "admin") {
      return res.status(403).json({ message: "صلاحيات المدير مطلوبة" });
    }
    next();
  });
}
