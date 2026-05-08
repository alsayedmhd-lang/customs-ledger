import { sqlite } from "@workspace/db";

let ensured = false;

export function ensureSyncQueueTable() {
  if (ensured || !sqlite) return;

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      operation TEXT NOT NULL,
      payload_json TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      retry_count INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      synced_at INTEGER,
      created_at INTEGER,
      updated_at INTEGER
    );
  `);

  const columns = sqlite.prepare("PRAGMA table_info(sync_queue)").all() as Array<{ name: string }>;
  const existing = new Set(columns.map((column) => column.name));

  if (!existing.has("synced_at")) {
    sqlite.exec("ALTER TABLE sync_queue ADD COLUMN synced_at INTEGER");
  }

  ensured = true;
  console.log("Ensured sync_queue table");
}
