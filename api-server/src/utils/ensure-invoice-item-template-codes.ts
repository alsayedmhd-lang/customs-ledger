import { randomUUID } from "node:crypto";
import { sqlite } from "@workspace/db";

const knownCodes = new Map([
  ["التخليص الجمركي customs clearance fees", "101"],
  ["إذن التسليم delivery order fee", "102"],
  ["النقليات transportation fees", "103"],
  ["العمال labor fees", "104"],
  ["رسوم الجمارك customs duties", "105"],
  ["مصاريف أخرى other expenses", "106"],
  ["رسوم تعديل البيان declaration amendment fees", "107"],
]);

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

export function ensureInvoiceItemTemplateCodes(): void {
  if (!sqlite) return;

  const columns = sqlite.prepare(
    "PRAGMA table_info(invoice_item_templates)"
  ).all() as Array<{ name: string }>;

  if (!columns.some((column) => column.name === "item_code")) {
    sqlite.exec("ALTER TABLE invoice_item_templates ADD COLUMN item_code TEXT");
  }

  const rows = sqlite.prepare(
    "SELECT id, description, item_code AS itemCode FROM invoice_item_templates"
  ).all() as Array<{ id: number; description: string; itemCode: string | null }>;

  const update = sqlite.prepare(
    "UPDATE invoice_item_templates SET item_code = ? WHERE id = ?"
  );

  sqlite.transaction(() => {
    for (const row of rows) {
      const expected = knownCodes.get(normalize(row.description));
      if (expected && row.itemCode && row.itemCode !== expected) {
        throw new Error(`Conflicting template code for local id ${row.id}`);
      }
      if (!row.itemCode) {
        update.run(expected ?? `X-${randomUUID()}`, row.id);
      }
    }
    sqlite.exec(
      "CREATE UNIQUE INDEX IF NOT EXISTS invoice_item_templates_item_code_unique ON invoice_item_templates(item_code)"
    );
  })();
}
