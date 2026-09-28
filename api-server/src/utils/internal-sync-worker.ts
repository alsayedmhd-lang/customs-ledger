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
const TIMESTAMP_COLUMNS = new Set([
  "clients.created_at", "clients.updated_at", "users.created_at",
  "invoice_item_templates.created_at", "invoices.created_at", "invoices.updated_at",
  "invoices.deleted_at", "receipts.created_at", "receipts.deleted_at",
]);
const quote = (value: string) => `"${value}"`;
let inFlight: Promise<{ processed: number; changedRows: number }> | null = null;
let pullInFlight = false;

export function runInternalLocalToServerOnce(connectionString: string) {
  if (pullInFlight) throw new Error("An internal server pull is in progress");
  if (inFlight) return inFlight;
  inFlight = performInternalPush(connectionString).finally(() => { inFlight = null; });
  return inFlight;
}

// The server is authoritative only when this direction is selected. The
// journal gate prevents overwriting local changes that have not been sent.
// Hard deletes on the server are deliberately not inferred from absence.
export async function runInternalServerToLocalOnce(connectionString: string) {
  if (inFlight || pullInFlight) throw new Error("An internal sync is already in progress");
  pullInFlight = true;
  try {
    return await performInternalPull(connectionString);
  } finally {
    pullInFlight = false;
  }
}

function fromInternalValue(table: string, column: string, type: string, value: unknown): unknown {
  if (value == null) return null;
  if (table === "customer_ledger" && column === "created_at") {
    if (typeof value === "string" && !/^\d+(?:\.\d+)?$/.test(value)) return value;
    const date = new Date(Number(value));
    if (!Number.isFinite(date.getTime())) throw new Error("Invalid customer_ledger.created_at");
    return date.toISOString().slice(0, 19).replace("T", " ");
  }
  if (TIMESTAMP_COLUMNS.has(`${table}.${column}`)) {
    const timestamp = value instanceof Date ? value.getTime() : Date.parse(`${String(value).replace(" ", "T")}Z`);
    if (!Number.isFinite(timestamp)) throw new Error(`Invalid timestamp in ${table}.${column}`);
    return timestamp;
  }
  if (value instanceof Date) return value.getTime();
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "object") return JSON.stringify(value);
  if (typeof value === "string" && /^(INTEGER|REAL|NUMERIC|DECIMAL|FLOAT|DOUBLE)/i.test(type)) {
    const number = Number(value);
    if (!Number.isFinite(number)) throw new Error(`Invalid numeric value in ${table}.${column}`);
    return number;
  }
  return value;
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

async function performInternalPull(connectionString: string) {
  ensureInternalSyncJournal();
  if (!sqlite) throw new Error("SQLite database is unavailable");
  const pending = sqlite.prepare("SELECT COUNT(*) AS count FROM internal_sync_journal").get() as { count: number };
  if (pending.count) throw new Error(`Send ${pending.count} pending local changes before pulling from the internal server`);
  const client = new Client({ connectionString, connectionTimeoutMillis: 5000 });
  let inPgTransaction = false;
  const source: Array<{ name: string; columns: Array<{ name: string; type: string }>; rows: Array<Record<string, unknown>> }> = [];
  try {
    await client.connect();
    await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    inPgTransaction = true;
    await client.query("SET LOCAL statement_timeout = '30s'");
    for (const table of TABLES) {
      const columns = sqlite.prepare(`PRAGMA table_info(${quote(table)})`).all() as Array<{ name: string; type: string }>;
      const result = await client.query(`SELECT ${columns.map(({ name }) =>
        TIMESTAMP_COLUMNS.has(`${table}.${name}`) ? `${quote(name)}::text AS ${quote(name)}` : quote(name)
      ).join(", ")} FROM public.${quote(table)} ORDER BY id`);
      source.push({ name: table, columns, rows: result.rows });
    }
    await client.query("COMMIT");
    inPgTransaction = false;
  } catch (error) {
    if (inPgTransaction) await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    await client.end().catch(() => undefined);
  }

  // better-sqlite3 transactions are synchronous. This second check closes
  // the gap between fetching the server snapshot and writing to SQLite.
  return sqlite.transaction(() => {
    const current = sqlite!.prepare("SELECT COUNT(*) AS count FROM internal_sync_journal").get() as { count: number };
    if (current.count) throw new Error(`Local changes appeared during pull (${current.count}); send them first`);
    let inserted = 0;
    let updated = 0;
    sqlite!.prepare("UPDATE internal_sync_control SET capture_enabled = 0 WHERE id = 1").run();
    for (const table of source) {
      const names = table.columns.map(({ name }) => name);
      const select = sqlite!.prepare(`SELECT * FROM ${quote(table.name)} WHERE id = ?`);
      const insert = sqlite!.prepare(
        `INSERT INTO ${quote(table.name)} (${names.map(quote).join(", ")}) VALUES (${names.map(() => "?").join(", ")})`,
      );
      const updateNames = names.filter((name) => name !== "id");
      const update = sqlite!.prepare(
        `UPDATE ${quote(table.name)} SET ${updateNames.map((name) => `${quote(name)} = ?`).join(", ")} WHERE id = ?`,
      );
      for (const remote of table.rows) {
        const id = remote.id;
        const local = select.get(id) as Record<string, unknown> | undefined;
        const mapped = table.columns.map(({ name, type }) => {
          if (local && table.name === "customer_ledger" && name === "created_at") return local[name];
          const received = fromInternalValue(table.name, name, type, remote[name]);
          if (local && table.name === "users" && (name === "permissions" || name === "client_view_permissions")) {
            try {
              if (canonicalJson(JSON.parse(String(local[name]))) === canonicalJson(remote[name])) return local[name];
            } catch { /* An invalid local JSON value will be replaced by the server value. */ }
          }
          return received;
        });
        if (!local) {
          insert.run(...mapped);
          inserted++;
        } else if (table.columns.some(({ name }, index) => local[name] !== mapped[index])) {
          update.run(...updateNames.map((name) => mapped[names.indexOf(name)]), id);
          updated++;
        }
      }
    }
    sqlite!.prepare("UPDATE internal_sync_control SET capture_enabled = 1 WHERE id = 1").run();
    return { inserted, updated, serverRows: source.reduce((count, table) => count + table.rows.length, 0) };
  })();
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
