import { sqlite } from "@workspace/db";
import { createRequire } from "module";
import { convertInternalValue } from "./internal-bootstrap";
import { ensureInternalSyncJournal } from "./internal-sync-journal";

const require = createRequire(process.cwd() + "/package.json");
const { Client } = require("pg") as { Client: new (options: { connectionString: string; connectionTimeoutMillis: number }) => {
  connect(): Promise<void>;
  query(sql: string, values?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>;
  end(): Promise<void>;
} };

const TABLES = [
  "clients", "users", "invoice_item_templates", "invoices", "invoice_items",
  "invoice_accounting", "receipts", "customer_ledger", "invoice_audit_logs",
] as const;
const quote = (value: string) => `"${value}"`;
let inFlight: Promise<{ processed: number; changedRows: number }> | null = null;

export function runInternalLocalToServerOnce(connectionString: string) {
  if (inFlight) return inFlight;
  inFlight = performInternalPush(connectionString).finally(() => { inFlight = null; });
  return inFlight;
}

async function performInternalPush(connectionString: string) {
  ensureInternalSyncJournal();
  if (!sqlite) throw new Error("SQLite database is unavailable");
  const changes = sqlite.prepare(`
    SELECT id, table_name AS tableName, row_id AS rowId
    FROM internal_sync_journal ORDER BY id LIMIT 500
  `).all() as Array<{ id: number; tableName: string; rowId: number }>;
  if (!changes.length) return { processed: 0, changedRows: 0 };
  const watermark = changes[changes.length - 1].id;
  const validTables = new Set<string>(TABLES);
  const rowIds = new Map<string, Set<number>>();
  for (const change of changes) {
    if (!validTables.has(change.tableName)) throw new Error(`Unknown internal sync table: ${change.tableName}`);
    if (!rowIds.has(change.tableName)) rowIds.set(change.tableName, new Set());
    rowIds.get(change.tableName)!.add(change.rowId);
  }
  // Snapshot the rows before the network request. New journal entries remain
  // beyond the watermark and will be processed on the next run.
  const snapshot = TABLES.map((table) => ({
    name: table,
    columns: (sqlite.prepare(`PRAGMA table_info(${quote(table)})`).all() as Array<{ name: string }>).map((item) => item.name),
    rows: [...(rowIds.get(table) || [])].map((id) => ({
      id,
      row: sqlite.prepare(`SELECT * FROM ${quote(table)} WHERE id = ?`).get(id) as Record<string, unknown> | undefined,
    })),
  }));
  const client = new Client({ connectionString, connectionTimeoutMillis: 5000 });
  let inTransaction = false;
  try {
    await client.connect();
    await client.query("BEGIN");
    inTransaction = true;
    await client.query("SET LOCAL statement_timeout = '30s'");
    await client.query("SELECT pg_advisory_xact_lock(68291301)");
    // Children are removed first; parent rows are inserted first.
    for (const table of [...snapshot].reverse()) {
      for (const { id, row } of table.rows) {
        if (!row) await client.query(`DELETE FROM public.${quote(table.name)} WHERE id = $1`, [id]);
      }
    }
    for (const table of snapshot) {
      for (const { row } of table.rows) {
        if (!row) continue;
        const values = table.columns.map((column) => convertInternalValue(table.name, column, row[column]));
        const updates = table.columns.filter((column) => column !== "id")
          .map((column) => `${quote(column)} = EXCLUDED.${quote(column)}`).join(", ");
        await client.query(
          `INSERT INTO public.${quote(table.name)} (${table.columns.map(quote).join(", ")}) ` +
          `VALUES (${table.columns.map((_, index) => `$${index + 1}`).join(", ")}) ` +
          `ON CONFLICT (id) DO UPDATE SET ${updates}`,
          values,
        );
      }
      if (table.rows.some(({ row }) => Boolean(row))) {
        await client.query(
          `SELECT setval(pg_get_serial_sequence('public.${table.name}', 'id'), ` +
          `(SELECT MAX(id) FROM public.${quote(table.name)}))`,
        );
      }
    }
    await client.query("COMMIT");
    inTransaction = false;
    sqlite.prepare("DELETE FROM internal_sync_journal WHERE id <= ?").run(watermark);
    return { processed: changes.length, changedRows: snapshot.reduce((total, table) => total + table.rows.length, 0) };
  } catch (error) {
    if (inTransaction) await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    await client.end().catch(() => undefined);
  }
}
