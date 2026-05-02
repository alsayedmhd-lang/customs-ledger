import { sqliteTable, integer, text, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const customerLedgerTableSqlite = sqliteTable("customer_ledger", {
  id: integer("id").primaryKey({ autoIncrement: true }),

  clientId: integer("client_id").notNull(),

  invoiceId: integer("invoice_id"),
  receiptId: integer("receipt_id"),

  entryDate: text("entry_date").notNull(),

  entryType: text("entry_type").notNull(),

  descriptionAr: text("description_ar").notNull(),
  descriptionEn: text("description_en").notNull(),

  referenceType: text("reference_type").notNull(),
  referenceNumber: text("reference_number"),

  debit: real("debit").notNull().default(0),
  credit: real("credit").notNull().default(0),

  balanceImpact: real("balance_impact").notNull().default(0),

  createdBy: integer("created_by"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});