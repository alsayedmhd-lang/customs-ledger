import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, sqlite } from "@workspace/db";
import {
  clientsTable,
  DEFAULT_CLIENT_VIEW_PERMISSIONS,
  DEFAULT_PERMISSIONS,
  usersTable,
  type UserPermissions,
} from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin, requireAuth } from "../middleware/auth";

const router = Router();

const blockedManagerRoles = new Set(["admin", "manager"]);
const editableRoles = new Set(["user", "supervisor", "client"]);
type ClientViewPermissions = typeof DEFAULT_CLIENT_VIEW_PERMISSIONS;

const NO_EDIT_PERMISSIONS: UserPermissions = {
  canEditInvoices: false,
  canDeleteInvoices: false,
  canEditReceipts: false,
  canDeleteReceipts: false,
  canEditClients: false,
  canDeleteClients: false,
  canManageTemplates: false,
  canViewStatements: false,
  canViewAccounting: false,
  canCustomizePrintContact: false,
};

function ensureUserClientColumns() {
  if (!sqlite) return;
  const columns = sqlite.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
  const existing = new Set(columns.map((column) => column.name));
  if (!existing.has("client_id")) sqlite.exec("ALTER TABLE users ADD COLUMN client_id INTEGER");
  if (!existing.has("client_view_permissions")) {
    sqlite.exec(`ALTER TABLE users ADD COLUMN client_view_permissions TEXT DEFAULT '${JSON.stringify(DEFAULT_CLIENT_VIEW_PERMISSIONS)}'`);
  }
}

function normalizeClientViewPermissions(input: unknown): ClientViewPermissions {
  const value = input && typeof input === "object" ? input as Partial<ClientViewPermissions> : {};
  return {
    canViewInvoices: value.canViewInvoices ?? DEFAULT_CLIENT_VIEW_PERMISSIONS.canViewInvoices,
    canViewReceipts: value.canViewReceipts ?? DEFAULT_CLIENT_VIEW_PERMISSIONS.canViewReceipts,
    canViewStatement: value.canViewStatement ?? DEFAULT_CLIENT_VIEW_PERMISSIONS.canViewStatement,
    canViewSummary: value.canViewSummary ?? DEFAULT_CLIENT_VIEW_PERMISSIONS.canViewSummary,
  };
}

async function assertClientExists(clientId: number) {
  const [client] = await db.select({ id: clientsTable.id }).from(clientsTable).where(eq(clientsTable.id, clientId)).limit(1);
  return !!client;
}

function formatUser(u: typeof usersTable.$inferSelect) {
  const permissions = u.role === "admin" ? DEFAULT_PERMISSIONS : u.role === "client" ? NO_EDIT_PERMISSIONS : (u.permissions ?? DEFAULT_PERMISSIONS);
  return {
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    displayNameAr: u.displayNameAr ?? null,
    displayNameEn: u.displayNameEn ?? null,
    role: u.role,
    isActive: u.isActive,
    pendingApproval: u.pendingApproval,
    permissions,
    email: u.email ?? null,
    phone: u.phone ?? null,
    receiverSignatureBase64: u.receiverSignatureBase64 ?? null,
    whatsappApiKey: u.whatsappApiKey ?? null,
    twoFactorEmail: u.twoFactorEmail ?? false,
    twoFactorWhatsapp: u.twoFactorWhatsapp ?? false,
    clientId: u.clientId ?? null,
    clientViewPermissions: normalizeClientViewPermissions(u.clientViewPermissions),
    createdAt: u.createdAt,
  };
}

ensureUserClientColumns();

router.get("/users", requireAdmin, async (_req, res) => {
  ensureUserClientColumns();
  const users = await db.select().from(usersTable).orderBy(usersTable.id);
  return res.json(users.map(formatUser));
});

router.post("/users", requireAdmin, async (req, res) => {
  ensureUserClientColumns();
  const { username, password, displayName, displayNameAr, displayNameEn, role, clientId, clientViewPermissions, twoFactorEmail, twoFactorWhatsapp } = req.body as {
    username: string;
    password: string;
    displayName: string;
    displayNameAr?: string;
    displayNameEn?: string;
    role: string;
    clientId?: number | string | null;
    clientViewPermissions?: Partial<ClientViewPermissions>;
    twoFactorEmail?: boolean;
    twoFactorWhatsapp?: boolean;
  };

  if (!username || !password || !displayName) {
    return res.status(400).json({ message: "All required fields must be provided" });
  }
  if (blockedManagerRoles.has(role)) {
    return res.status(403).json({ message: "Creating another manager is not allowed" });
  }

  const normalizedRole = editableRoles.has(role) ? role : "user";
  const normalizedClientId = clientId ? Number(clientId) : null;
  if (normalizedRole === "client") {
    if (!normalizedClientId || Number.isNaN(normalizedClientId)) {
      return res.status(400).json({ message: "Client user requires a linked client" });
    }
    if (!(await assertClientExists(normalizedClientId))) {
      return res.status(400).json({ message: "Client not found" });
    }
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
      role: normalizedRole,
      clientId: normalizedRole === "client" ? normalizedClientId : null,
      clientViewPermissions: normalizedRole === "client" ? normalizeClientViewPermissions(clientViewPermissions) : DEFAULT_CLIENT_VIEW_PERMISSIONS,
      twoFactorEmail: twoFactorEmail ?? false,
      twoFactorWhatsapp: twoFactorWhatsapp ?? false,
      permissions: normalizedRole === "client" ? NO_EDIT_PERMISSIONS : DEFAULT_PERMISSIONS,
    })
    .returning();
  return res.status(201).json(formatUser(user));
});

router.patch("/users/:id", requireAdmin, async (req, res) => {
  ensureUserClientColumns();
  const id = parseInt(req.params.id);
  const {
    displayName,
    displayNameAr,
    displayNameEn,
    role,
    isActive,
    pendingApproval,
    password,
    permissions,
    email,
    phone,
    receiverSignatureBase64,
    whatsappApiKey,
    twoFactorEmail,
    twoFactorWhatsapp,
    clientId,
    clientViewPermissions,
  } = req.body as {
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
    receiverSignatureBase64?: string | null;
    whatsappApiKey?: string | null;
    twoFactorEmail?: boolean;
    twoFactorWhatsapp?: boolean;
    clientId?: number | string | null;
    clientViewPermissions?: Partial<ClientViewPermissions>;
  };

  const [currentUser] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  if (!currentUser) return res.status(404).json({ message: "User not found" });

  const updates: Partial<typeof usersTable.$inferInsert> = {};
  if (displayName) updates.displayName = displayName.trim();
  if (typeof displayNameAr !== "undefined") updates.displayNameAr = displayNameAr?.trim() || null;
  if (typeof displayNameEn !== "undefined") updates.displayNameEn = displayNameEn?.trim() || null;
  if (role) {
    if (blockedManagerRoles.has(role)) {
      return res.status(403).json({ message: "Changing a user to manager is not allowed" });
    }
    updates.role = editableRoles.has(role) ? role : "user";
  }
  if (typeof isActive === "boolean") updates.isActive = isActive;
  if (typeof pendingApproval === "boolean") updates.pendingApproval = pendingApproval;
  if (password) updates.passwordHash = await bcrypt.hash(password, 10);
  if (typeof email !== "undefined") updates.email = email?.trim() || null;
  if (typeof phone !== "undefined") updates.phone = phone?.trim() || null;
  if (typeof receiverSignatureBase64 !== "undefined") updates.receiverSignatureBase64 = receiverSignatureBase64 || null;
  if (typeof whatsappApiKey !== "undefined") updates.whatsappApiKey = whatsappApiKey?.trim() || null;
  if (typeof twoFactorEmail !== "undefined") updates.twoFactorEmail = !!twoFactorEmail;
  if (typeof twoFactorWhatsapp !== "undefined") updates.twoFactorWhatsapp = !!twoFactorWhatsapp;

  const effectiveRole = updates.role || currentUser.role;
  if (effectiveRole === "client") {
    const normalizedClientId = clientId ? Number(clientId) : currentUser.clientId;
    if (!normalizedClientId || Number.isNaN(normalizedClientId)) {
      return res.status(400).json({ message: "Client user requires a linked client" });
    }
    if (!(await assertClientExists(normalizedClientId))) {
      return res.status(400).json({ message: "Client not found" });
    }
    updates.clientId = normalizedClientId;
    updates.clientViewPermissions = normalizeClientViewPermissions(clientViewPermissions ?? currentUser.clientViewPermissions);
    updates.permissions = NO_EDIT_PERMISSIONS;
  } else if (role && updates.role !== "client") {
    updates.clientId = null;
    updates.clientViewPermissions = DEFAULT_CLIENT_VIEW_PERMISSIONS;
  }

  if (permissions && effectiveRole !== "client") {
    const existing = currentUser.permissions ?? DEFAULT_PERMISSIONS;
    updates.permissions = { ...existing, ...permissions } as UserPermissions;
  }

  if (Object.keys(updates).length === 0) return res.status(400).json({ message: "No data to update" });
  const [user] = await db.update(usersTable).set(updates).where(eq(usersTable.id, id)).returning();
  return res.json(formatUser(user));
});

router.delete("/users/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  if (req.user!.userId === id) return res.status(400).json({ message: "You cannot delete your own account" });
  const [deleted] = await db.delete(usersTable).where(eq(usersTable.id, id)).returning({ id: usersTable.id });
  if (!deleted) return res.status(404).json({ message: "User not found" });
  return res.json({ message: "User deleted" });
});

router.patch("/users/:id/change-password", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  if (req.user!.userId !== id && req.user!.role !== "admin") {
    return res.status(403).json({ message: "Forbidden" });
  }
  const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword: string };
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  if (!user) return res.status(404).json({ message: "User not found" });
  if (req.user!.role !== "admin") {
    if (!currentPassword || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }
  }
  const passwordHash = await bcrypt.hash(newPassword, 10);
  await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, id));
  return res.json({ message: "Password changed" });
});

export default router;
