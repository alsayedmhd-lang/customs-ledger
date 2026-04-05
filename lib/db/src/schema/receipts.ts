import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  numeric,
  pgEnum,
} from "drizzle-orm/pg-core";
import { clientsTable } from "./clients";
import { invoicesTable } from "./invoices";

export const paymentMethodEnum = pgEnum("payment_method", [
  "cash",
  "transfer",
  "check",
]);

export const receiptsTable = pgTable("receipts", {
  id: serial("id").primaryKey(),
  receiptNumber: text("receipt_number").notNull().unique(),
  clientId: integer("client_id")
    .notNull()
    .references(() => clientsTable.id, { onDelete: "restrict" }),
  invoiceId: integer("invoice_id")
    .references(() => invoicesTable.id, { onDelete: "set null" }),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  paymentMethod: paymentMethodEnum("payment_method").notNull().default("cash"),
  notes: text("notes"),
  receiptDate: text("receipt_date").notNull(),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Receipt = typeof receiptsTable.$inferSelect;
