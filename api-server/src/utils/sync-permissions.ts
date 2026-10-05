import { sqlite } from "@workspace/db";
import type { AuthPayload } from "../middleware/auth";
import type { Request, Response, NextFunction } from "express";

export function getDashboardSyncPermissions(user: AuthPayload | undefined) {
  // Preserve the existing authenticated administrator and emergency-login access.
  if (user?.role === "admin") return { online: true, internal: true };
  if (!user || !sqlite) return { online: false, internal: false };
  const account = sqlite.prepare(
    "SELECT role, is_active, pending_approval, permissions FROM users WHERE id = ?"
  ).get(user.userId) as { role: string | null; is_active: number | null; pending_approval: number | null; permissions: string | null } | undefined;
  if (!account || account.is_active === 0 || account.pending_approval === 1) return { online: false, internal: false };
  if (account.role === "admin") return { online: true, internal: true };
  try {
    const permissions = JSON.parse(account.permissions || "{}");
    return { online: permissions?.canRunOnlineSync === true, internal: permissions?.canRunInternalSync === true };
  } catch { return { online: false, internal: false }; }
}
export function requireDashboardSyncPermission(target: "online" | "internal") {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!getDashboardSyncPermissions(req.user)[target]) return res.status(403).json({ message: "Sync permission is required" });
      return next();
    } catch { return res.status(503).json({ message: "Sync permissions are unavailable" }); }
  };
}
