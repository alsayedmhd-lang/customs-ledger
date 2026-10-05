import { sqlite } from "@workspace/db";

// Local preference only: never synchronized to another device.
export function internalConnectionEnabled(): boolean {
  if (!sqlite) return false;
  const columns = sqlite.prepare("PRAGMA table_info(company_settings)").all() as Array<{ name: string }>;
  if (!columns.some(row => row.name === "internal_connection_enabled")) {
    sqlite.exec("ALTER TABLE company_settings ADD COLUMN internal_connection_enabled INTEGER NOT NULL DEFAULT 0");
  }
  const row = sqlite.prepare("SELECT internal_connection_enabled AS enabled FROM company_settings LIMIT 1").get() as { enabled: number } | undefined;
  return row?.enabled === 1;
}

export function setInternalConnectionEnabled(enabled: boolean) {
  internalConnectionEnabled();
  if (!sqlite) throw new Error("Local database is unavailable");
  const result = sqlite.prepare(enabled
    ? "UPDATE company_settings SET internal_connection_enabled = 1"
    : "UPDATE company_settings SET internal_connection_enabled = 0, internal_sync_auto_sync = 0").run();
  if (!result.changes) throw new Error("Settings row is missing");
}
