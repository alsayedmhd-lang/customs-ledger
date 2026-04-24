import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const clientsTableSqlite = sqliteTable("clients", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  taxId: text("tax_id"),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
});

export const insertClientSchemaSqlite = createInsertSchema(clientsTableSqlite).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertClientSqlite = z.infer<typeof insertClientSchemaSqlite>;
export type ClientSqlite = typeof clientsTableSqlite.$inferSelect;