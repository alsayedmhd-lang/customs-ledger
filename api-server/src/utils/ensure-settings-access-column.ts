import { sqlite } from "@workspace/db";
export function ensureSettingsAccessColumn() {
  if (!sqlite) return;
  const columns = sqlite.prepare("PRAGMA table_info(company_settings)").all() as Array<{ name: string }>;
  if (columns.length && !columns.some(c => c.name === "manager_settings_access")) {
    sqlite.exec("ALTER TABLE company_settings ADD COLUMN manager_settings_access TEXT DEFAULT ''");
  }
}
