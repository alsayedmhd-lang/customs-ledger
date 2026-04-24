import { sqliteTable, integer, text, real } from "drizzle-orm/sqlite-core";

export const invoicesTableSqlite = sqliteTable("invoices", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  invoiceNumber: text("invoice_number").notNull(),
  clientId: integer("client_id").notNull(),
  issueDate: text("issue_date").notNull(),
  dueDate: text("due_date"),
  status: text("status").default("draft"),
  subtotal: real("subtotal").default(0),
  taxRate: real("tax_rate").default(0),
  taxAmount: real("tax_amount").default(0),
  total: real("total").default(0),
  notes: text("notes"),
  shipmentRef: text("shipment_ref"),
  billOfLading: text("bill_of_lading"),
  packageCount: integer("package_count"),
  shipmentWeight: real("shipment_weight"),
  portOfEntry: text("port_of_entry"),
  importerExporterName: text("importer_exporter_name"),
  advancePayment: real("advance_payment").default(0),
  createdBy: integer("created_by"),
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
});

export const invoiceItemsTableSqlite = sqliteTable("invoice_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  invoiceId: integer("invoice_id").notNull(),
  description: text("description").notNull(),
  quantity: real("quantity").notNull(),
  unitPrice: real("unit_price").notNull(),
  total: real("total").notNull(),
});

export const invoiceItemTemplatesTableSqlite = sqliteTable("invoice_item_templates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  description: text("description").notNull(),
  defaultUnitPrice: real("default_unit_price").default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" }),
});

export const invoiceAccountingTableSqlite = sqliteTable("invoice_accounting", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  invoiceId: integer("invoice_id").notNull(),
  payments: real("payments").default(0),
  transportation: real("transportation").default(0),
  labor: real("labor").default(0),
  otherExpenses: real("other_expenses").default(0),
  driverName: text("driver_name"),
  unloadLocation: text("unload_location"),
  transportationPaid: integer("transportation_paid", { mode: "boolean" }).default(false),
  laborPaid: integer("labor_paid", { mode: "boolean" }).default(false),
  otherExpensesPaid: integer("other_expenses_paid", { mode: "boolean" }).default(false),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
});