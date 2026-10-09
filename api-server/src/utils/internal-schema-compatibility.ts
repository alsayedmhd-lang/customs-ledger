import { sqlite } from "@workspace/db";

const TABLES = [
  "clients", "users", "invoice_item_templates", "invoices", "invoice_items",
  "invoice_accounting", "receipts", "customer_ledger", "invoice_audit_logs",
] as const;

export async function ensureInternalSchemaCompatibility(client: any) {
  if (!sqlite) throw new Error("SQLite database is unavailable");

  // One PostgreSQL query: these additive changes succeed or fail together.
  await client.query(`
    ALTER TABLE public.invoices
      ADD COLUMN IF NOT EXISTS sync_id TEXT,
      ADD COLUMN IF NOT EXISTS created_source TEXT NOT NULL DEFAULT 'desktop';
    ALTER TABLE public.receipts
      ADD COLUMN IF NOT EXISTS sync_id TEXT,
      ADD COLUMN IF NOT EXISTS created_source TEXT NOT NULL DEFAULT 'desktop';
  `);

  const metadata = await client.query(
    `SELECT table_name, column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
    [TABLES],
  );
  const remote = new Map<string, Set<string>>();
  for (const row of metadata.rows) {
    if (!remote.has(row.table_name)) remote.set(row.table_name, new Set());
    remote.get(row.table_name)!.add(row.column_name);
  }

  const missing: string[] = [];
  for (const table of TABLES) {
    const local = sqlite.prepare(`PRAGMA table_info("${table}")`).all() as Array<{name: string}>;
    const columns = remote.get(table);
    if (!columns) {
      missing.push(`${table}: table missing`);
      continue;
    }
    for (const column of local) {
      if (!columns.has(column.name)) missing.push(`${table}.${column.name}`);
    }
  }
  if (missing.length) {
    throw new Error(`Missing internal schema columns: ${missing.join(", ")}; no business records sent`);
  }
}
