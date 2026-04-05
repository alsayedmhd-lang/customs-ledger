import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable, DEFAULT_PERMISSIONS, type UserPermissions } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin, requireAuth } from "../middleware/auth";

const router = Router();

function formatUser(u: typeof usersTable.$inferSelect) {
  const permissions = u.role === "admin" ? DEFAULT_PERMISSIONS : (u.permissions ?? DEFAULT_PERMISSIONS);
  return { id: u.id, username: u.username, displayName: u.displayName, displayNameAr: u.displayNameAr ?? null, displayNameEn: u.displayNameEn ?? null, role: u.role, isActive: u.isActive, pendingApproval: u.pendingApproval, permissions, email: u.email ?? null, phone: u.phone ?? null, whatsappApiKey: u.whatsappApiKey ?? null, createdAt: u.createdAt };
}

router.get("/users", requireAdmin, async (_req, res) => {
  const users = await db.select().from(usersTable).orderBy(usersTable.id);
  return res.json(users.map(formatUser));
});

router.post("/users", requireAdmin, async (req, res) => {
  const { username, password, displayName, displayNameAr, displayNameEn, role } = req.body as { username: string; password: string; displayName: string; displayNameAr?: string; displayNameEn?: string; role: string };
  if (!username || !password || !displayName) {
    return res.status(400).json({ message: "جميع الحقول مطلوبة" });
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const [user] = await db
    .insert(usersTable)
    .values({
      username: username.trim().toLowerCase(),
      passwordHash,
      displayName: displayName.trim(),
      displayNameAr: displayNameAr?.trim() || null,
      displayNameEn: displayNameEn?.trim() || null,
      role: ["admin", "supervisor"].includes(role) ? role : "user",
      permissions: DEFAULT_PERMISSIONS,
    })
    .returning();
  return res.status(201).json(formatUser(user));
});

router.patch("/users/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  const { displayName, displayNameAr, displayNameEn, role, isActive, pendingApproval, password, permissions, email, phone, whatsappApiKey } = req.body as {
    displayName?: string;
    displayNameAr?: string | null;
    displayNameEn?: string | null;
    role?: string;
    isActive?: boolean;
    pendingApproval?: boolean;
    password?: string;
    permissions?: Partial<UserPermissions>;
    email?: string | null;
    phone?: string | null;
    whatsappApiKey?: string | null;
  };
  const updates: Partial<typeof usersTable.$inferInsert> = {};
  if (displayName) updates.displayName = displayName.trim();
  if (typeof displayNameAr !== "undefined") updates.displayNameAr = displayNameAr?.trim() || null;
  if (typeof displayNameEn !== "undefined") updates.displayNameEn = displayNameEn?.trim() || null;
  if (role) updates.role = ["admin", "supervisor"].includes(role) ? role : "user";
  if (typeof isActive === "boolean") updates.isActive = isActive;
  if (typeof pendingApproval === "boolean") updates.pendingApproval = pendingApproval;
  if (password) updates.passwordHash = await bcrypt.hash(password, 10);
  if (typeof email !== "undefined") updates.email = email?.trim() || null;
  if (typeof phone !== "undefined") updates.phone = phone?.trim() || null;
  if (typeof whatsappApiKey !== "undefined") updates.whatsappApiKey = whatsappApiKey?.trim() || null;
  if (permissions) {
    const current = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
    const existing = current[0]?.permissions ?? DEFAULT_PERMISSIONS;
    updates.permissions = { ...existing, ...permissions } as UserPermissions;
  }
  if (Object.keys(updates).length === 0) return res.status(400).json({ message: "لا توجد بيانات للتحديث" });
  const [user] = await db.update(usersTable).set(updates).where(eq(usersTable.id, id)).returning();
  if (!user) return res.status(404).json({ message: "المستخدم غير موجود" });
  return res.json(formatUser(user));
});

router.delete("/users/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  if (req.user!.userId === id) return res.status(400).json({ message: "لا يمكن حذف حسابك الخاص" });
  const [deleted] = await db.delete(usersTable).where(eq(usersTable.id, id)).returning({ id: usersTable.id });
  if (!deleted) return res.status(404).json({ message: "المستخدم غير موجود" });
  return res.json({ message: "تم حذف المستخدم" });
});

router.patch("/users/:id/change-password", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  if (req.user!.userId !== id && req.user!.role !== "admin") {
    return res.status(403).json({ message: "غير مصرح" });
  }
  const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword: string };
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  if (!user) return res.status(404).json({ message: "المستخدم غير موجود" });
  if (req.user!.role !== "admin") {
    if (!currentPassword || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
      return res.status(401).json({ message: "كلمة السر الحالية غير صحيحة" });
    }
  }
  const passwordHash = await bcrypt.hash(newPassword, 10);
  await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, id));
  return res.json({ message: "تم تغيير كلمة السر" });
});

export default router;
