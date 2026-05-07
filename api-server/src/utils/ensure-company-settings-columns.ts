import { sqlite } from "@workspace/db";

export function ensureMasterPasswordHashColumn() {
  if (!sqlite) return;

  const table = sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'company_settings'")
    .get();

  if (!table) return;

  const columns = sqlite.prepare("PRAGMA table_info(company_settings)").all() as Array<{ name: string }>;
  const hasMasterPasswordHash = columns.some((column) => column.name === "master_password_hash");

  if (!hasMasterPasswordHash) {
    sqlite.exec("ALTER TABLE company_settings ADD COLUMN master_password_hash TEXT DEFAULT ''");
  }
}
