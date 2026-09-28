import { sqlite } from "@workspace/db";

const TABLES = [
  "clients", "users", "invoice_item_templates", "invoices", "invoice_items",
  "invoice_accounting", "receipts", "customer_ledger", "invoice_audit_logs",
] as const;

let installed = false;

export function ensureInternalSyncJournal() {
  if (!sqlite) throw new Error("SQLite database is unavailable");
  if (installed) return;
  sqlite.prepare(`
    CREATE TABLE IF NOT EXISTS internal_sync_journal (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_name TEXT NOT NULL,
      row_id INTEGER NOT NULL,
      operation TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )
  `).run();
  sqlite.prepare(`
    CREATE INDEX IF NOT EXISTS internal_sync_journal_row_idx
    ON internal_sync_journal(table_name, row_id, id)
  `).run();
  sqlite.prepare(`
    CREATE TABLE IF NOT EXISTS internal_sync_control (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      capture_enabled INTEGER NOT NULL DEFAULT 1
    )
  `).run();
  sqlite.prepare("INSERT OR IGNORE INTO internal_sync_control(id, capture_enabled) VALUES (1, 1)").run();
  // Recreate older triggers so a server pull can update SQLite without
  // sending those same rows straight back to PostgreSQL.
  for (const table of TABLES) {
    for (const [event, operation, reference] of [
      ["INSERT", "insert", "NEW"],
      ["UPDATE", "update", "NEW"],
      ["DELETE", "delete", "OLD"],
    ] as const) {
      sqlite.prepare(`DROP TRIGGER IF EXISTS internal_sync_${table}_${operation}`).run();
      sqlite.prepare(`
        CREATE TRIGGER internal_sync_${table}_${operation}
        AFTER ${event} ON "${table}"
        WHEN (SELECT capture_enabled FROM internal_sync_control WHERE id = 1) = 1
        BEGIN
          INSERT INTO internal_sync_journal (table_name, row_id, operation, created_at)
          VALUES ('${table}', ${reference}.id, '${operation}', CAST(unixepoch('now') * 1000 AS INTEGER));
        END
      `).run();
    }
  }
  installed = true;
}

export function getInternalSyncJournalStatus() {
  ensureInternalSyncJournal();
  const total = sqlite!.prepare("SELECT COUNT(*) AS count FROM internal_sync_journal").get() as { count: number };
  const byTable = sqlite!.prepare(`
    SELECT table_name AS tableName, COUNT(*) AS count
    FROM internal_sync_journal GROUP BY table_name ORDER BY table_name
  `).all() as Array<{ tableName: string; count: number }>;
  return { pendingChanges: Number(total.count), byTable };
}
