import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const invoiceAttachmentsTableSqlite = sqliteTable("invoice_attachments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  invoiceId: integer("invoice_id"),
  declarationNumber: text("declaration_number").notNull(),
  declarationBaseNumber: text("declaration_base_number").notNull(),
  fileName: text("file_name").notNull(),
  storedName: text("stored_name").notNull(),
  relativePath: text("relative_path").notNull(),
  mimeType: text("mime_type"),
  fileSize: integer("file_size"),
  category: text("category").notNull().default("other"),
  storageProvider: text("storage_provider").notNull().default("local"),
  createdBy: integer("created_by"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
});
