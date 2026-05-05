import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

export interface UserPermissions {
  canEditInvoices: boolean;
  canDeleteInvoices: boolean;
  canEditReceipts: boolean;
  canDeleteReceipts: boolean;
  canEditClients: boolean;
  canDeleteClients: boolean;
  canManageTemplates: boolean;
  canViewStatements: boolean;
  canViewAccounting: boolean;
  canCustomizePrintContact: boolean;
}

export interface ClientViewPermissions {
  canViewInvoices: boolean;
  canViewReceipts: boolean;
  canViewStatement: boolean;
  canViewSummary: boolean;
}

export const DEFAULT_PERMISSIONS: UserPermissions = {
  canEditInvoices: true,
  canDeleteInvoices: true,
  canEditReceipts: true,
  canDeleteReceipts: true,
  canEditClients: true,
  canDeleteClients: true,
  canManageTemplates: true,
  canViewStatements: true,
  canViewAccounting: true,
  canCustomizePrintContact: false,
};

export const DEFAULT_CLIENT_VIEW_PERMISSIONS: ClientViewPermissions = {
  canViewInvoices: true,
  canViewReceipts: true,
  canViewStatement: true,
  canViewSummary: true,
};

export const usersTableSqlite = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull(),
  displayNameAr: text("display_name_ar"),
  displayNameEn: text("display_name_en"),
  role: text("role").default("user"),
  isActive: integer("is_active", { mode: "boolean" }).default(true),
  pendingApproval: integer("pending_approval", { mode: "boolean" }).default(false),
  permissions: text("permissions", { mode: "json" }).default(JSON.stringify(DEFAULT_PERMISSIONS)),
  clientId: integer("client_id"),
  clientViewPermissions: text("client_view_permissions", { mode: "json" }).default(JSON.stringify(DEFAULT_CLIENT_VIEW_PERMISSIONS)),
  email: text("email"),
  phone: text("phone"),
  whatsappApiKey: text("whatsapp_api_key"),
  receiverSignatureBase64: text("receiver_signature_base64"),
  twoFactorEmail: integer("two_factor_email", { mode: "boolean" }).default(false),
  twoFactorWhatsapp: integer("two_factor_whatsapp", { mode: "boolean" }).default(false),
  createdAt: integer("created_at", { mode: "timestamp_ms" }),
});
export const otpCodesTable = sqliteTable("otp_codes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  code: text("code").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  usedAt: integer("used_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }),
});

