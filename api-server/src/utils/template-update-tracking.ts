import { sqlite } from "@workspace/db";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
export function ensureLocalTemplateUpdates() {
  if (!sqlite) return;
  const cols = sqlite.prepare("PRAGMA table_info(invoice_item_templates)").all() as Array<{name:string}>;
  if (!cols.some(c => c.name === "updated_at")) {
    if (sqlite.name && sqlite.name !== ":memory:") {
      const dir=join(dirname(sqlite.name),"backups");mkdirSync(dir,{recursive:true});
      const path=join(dir,`before-template-updates-${Date.now()}.db`).replace(/'/g,"''");
      sqlite.exec(`VACUUM INTO '${path}'`);
    }
    sqlite.exec("ALTER TABLE invoice_item_templates ADD COLUMN updated_at INTEGER");
  }
}
export async function ensurePgTemplateUpdates(client:any) {
  await client.query("ALTER TABLE invoice_item_templates ADD COLUMN IF NOT EXISTS updated_at timestamp");
}
