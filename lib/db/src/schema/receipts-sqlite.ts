import { sqliteTable, integer, text, real } from "drizzle-orm/sqlite-core";

export const receiptsTableSqlite = sqliteTable("receipts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  receiptNumber: text("receipt_number").notNull(),
  clientId: integer("client_id").notNull(),
  invoiceId: integer("invoice_id"),
  amount: real("amount").notNull(),
  paymentMethod: text("payment_method").default("cash"),
  notes: text("notes"),
  receiptDate: text("receipt_date").notNull(),
  createdBy: integer("created_by"),
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }),
});
