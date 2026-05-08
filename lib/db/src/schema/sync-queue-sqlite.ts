import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

export const syncQueueTableSqlite = sqliteTable("sync_queue", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  operation: text("operation").notNull(),
  payloadJson: text("payload_json"),
  status: text("status").notNull().default("pending"),
  retryCount: integer("retry_count").notNull().default(0),
  lastError: text("last_error"),
  syncedAt: integer("synced_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
});
