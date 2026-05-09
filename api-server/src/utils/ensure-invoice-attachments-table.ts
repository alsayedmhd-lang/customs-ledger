import { sqlite } from "@workspace/db";

let ensured = false;

const attachmentColumns = [
  ["invoice_id", "ALTER TABLE invoice_attachments ADD COLUMN invoice_id INTEGER"],
  ["declaration_number", "ALTER TABLE invoice_attachments ADD COLUMN declaration_number TEXT NOT NULL DEFAULT ''"],
  ["declaration_base_number", "ALTER TABLE invoice_attachments ADD COLUMN declaration_base_number TEXT NOT NULL DEFAULT ''"],
  ["file_name", "ALTER TABLE invoice_attachments ADD COLUMN file_name TEXT NOT NULL DEFAULT ''"],
  ["stored_name", "ALTER TABLE invoice_attachments ADD COLUMN stored_name TEXT NOT NULL DEFAULT ''"],
  ["relative_path", "ALTER TABLE invoice_attachments ADD COLUMN relative_path TEXT NOT NULL DEFAULT ''"],
  ["mime_type", "ALTER TABLE invoice_attachments ADD COLUMN mime_type TEXT"],
  ["file_size", "ALTER TABLE invoice_attachments ADD COLUMN file_size INTEGER"],
  ["category", "ALTER TABLE invoice_attachments ADD COLUMN category TEXT NOT NULL DEFAULT 'other'"],
  ["storage_provider", "ALTER TABLE invoice_attachments ADD COLUMN storage_provider TEXT NOT NULL DEFAULT 'local'"],
  ["created_by", "ALTER TABLE invoice_attachments ADD COLUMN created_by INTEGER"],
  ["created_at", "ALTER TABLE invoice_attachments ADD COLUMN created_at INTEGER NOT NULL DEFAULT 0"],
  ["deleted_at", "ALTER TABLE invoice_attachments ADD COLUMN deleted_at INTEGER"],
] as const;

export function ensureInvoiceAttachmentsTable() {
  if (ensured || !sqlite) return;

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS invoice_attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER,
      declaration_number TEXT NOT NULL,
      declaration_base_number TEXT NOT NULL,
      file_name TEXT NOT NULL,
      stored_name TEXT NOT NULL,
      relative_path TEXT NOT NULL,
      mime_type TEXT,
      file_size INTEGER,
      category TEXT NOT NULL DEFAULT 'other',
      storage_provider TEXT NOT NULL DEFAULT 'local',
      created_by INTEGER,
      created_at INTEGER NOT NULL,
      deleted_at INTEGER
    );
  `);

  const columns = sqlite.prepare("PRAGMA table_info(invoice_attachments)").all() as Array<{ name: string }>;
  const existing = new Set(columns.map((column) => column.name));

  for (const [column, sql] of attachmentColumns) {
    if (!existing.has(column)) sqlite.exec(sql);
  }

  ensured = true;
  console.log("Ensured invoice_attachments table");
}
