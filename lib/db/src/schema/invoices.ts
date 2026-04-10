import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  numeric,
  boolean,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clientsTable } from "./clients";
import { usersTable } from "./users";

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "draft",
  "issued",
  "paid",
  "cancelled",
]);

export const invoicesTable = pgTable("invoices", {
  id: serial("id").primaryKey(),
  invoiceNumber: text("invoice_number").notNull().unique(),
  clientId: integer("client_id")
    .notNull()
    .references(() => clientsTable.id, { onDelete: "restrict" }),
  issueDate: text("issue_date").notNull(),
  dueDate: text("due_date"),
  status: invoiceStatusEnum("status").notNull().default("draft"),
  subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull().default("0"),
  taxRate: numeric("tax_rate", { precision: 5, scale: 2 }).notNull().default("0"),
  taxAmount: numeric("tax_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  total: numeric("total", { precision: 12, scale: 2 }).notNull().default("0"),
  notes: text("notes"),
  shipmentRef: text("shipment_ref"),
  billOfLading: text("bill_of_lading"),
  packageCount: integer("package_count"),
  shipmentWeight: numeric("shipment_weight", { precision: 10, scale: 3 }),
  portOfEntry: text("port_of_entry"),
  importerExporterName: text("importer_exporter_name"),
  advancePayment: numeric("advance_payment", { precision: 12, scale: 2 }).notNull().default("0"),
  createdBy: integer("created_by").references(() => usersTable.id, { onDelete: "set null" }),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const invoiceItemsTable = pgTable("invoice_items", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id")
    .notNull()
    .references(() => invoicesTable.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  quantity: numeric("quantity", { precision: 10, scale: 3 }).notNull(),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
  total: numeric("total", { precision: 12, scale: 2 }).notNull(),
});

export const invoiceItemTemplatesTable = pgTable("invoice_item_templates", {
  id: serial("id").primaryKey(),
  description: text("description").notNull(),
  defaultUnitPrice: numeric("default_unit_price", { precision: 12, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const invoiceAccountingTable = pgTable("invoice_accounting", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id")
    .notNull()
    .unique()
    .references(() => invoicesTable.id, { onDelete: "cascade" }),
  payments: numeric("payments", { precision: 12, scale: 2 }).notNull().default("0"),
  transportation: numeric("transportation", { precision: 12, scale: 2 }).notNull().default("0"),
  labor: numeric("labor", { precision: 12, scale: 2 }).notNull().default("0"),
  otherExpenses: numeric("other_expenses", { precision: 12, scale: 2 }).notNull().default("0"),
  driverName: text("driver_name"),
  unloadLocation: text("unload_location"),
  transportationPaid: boolean("transportation_paid").notNull().default(false),
  laborPaid: boolean("labor_paid").notNull().default(false),
  otherExpensesPaid: boolean("other_expenses_paid").notNull().default(false),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type InvoiceAccounting = typeof invoiceAccountingTable.$inferSelect;

export const insertInvoiceItemSchema = createInsertSchema(invoiceItemsTable).omit({
  id: true,
  invoiceId: true,
});

export const insertInvoiceItemTemplateSchema = createInsertSchema(invoiceItemTemplatesTable).omit({
  id: true,
  createdAt: true,
});

export type Invoice = typeof invoicesTable.$inferSelect;
export type InvoiceItem = typeof invoiceItemsTable.$inferSelect;
export type InvoiceItemTemplate = typeof invoiceItemTemplatesTable.$inferSelect;
export type InsertInvoiceItem = z.infer<typeof insertInvoiceItemSchema>;
export type InsertInvoiceItemTemplate = z.infer<typeof insertInvoiceItemTemplateSchema>;
