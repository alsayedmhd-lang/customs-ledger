import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const invoiceAttachmentsTableSqlite = sqliteTable("invoice_attachments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  syncId: text("sync_id"),
  fileHash: text("file_hash"),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
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
}, (table) => [
  uniqueIndex("invoice_attachments_sync_id_unique")
    .on(table.syncId)
    .where(sql`${table.syncId} IS NOT NULL AND TRIM(${table.syncId}) <> ''`),
]);
