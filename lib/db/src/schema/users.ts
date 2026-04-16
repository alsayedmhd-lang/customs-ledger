import { pgTable, serial, text, boolean, timestamp, jsonb, integer } from "drizzle-orm/pg-core";

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

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull(),
  displayNameAr: text("display_name_ar"),
  displayNameEn: text("display_name_en"),
  role: text("role").notNull().default("user"),
  isActive: boolean("is_active").notNull().default(true),
  pendingApproval: boolean("pending_approval").notNull().default(false),
  permissions: jsonb("permissions").$type<UserPermissions>().default(DEFAULT_PERMISSIONS),
  email: text("email"),
  phone: text("phone"),
  whatsappApiKey: text("whatsapp_api_key"),
  twoFactorEmail: boolean("two_factor_email").default(false),
  twoFactorWhatsapp: boolean("two_factor_whatsapp").default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const otpCodesTable = pgTable("otp_codes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  code: text("code").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type User = typeof usersTable.$inferSelect;
export type OtpCode = typeof otpCodesTable.$inferSelect;
