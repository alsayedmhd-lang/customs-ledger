import { sqlite } from "@workspace/db";
import { createRequire } from "module";

const require = createRequire(process.cwd() + "/package.json");
const { Client } = require("pg") as { Client: new (options: { connectionString: string; connectionTimeoutMillis: number }) => {
  connect(): Promise<void>;
  query(sql: string, values?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>;
  end(): Promise<void>;
} };

// Order preserves foreign keys. Attachments are omitted because their files
// live outside SQLite; settings, OTP codes and Online's queue are device local.
const COPY_TABLES = [
  "clients", "users", "invoice_item_templates", "invoices", "invoice_items",
  "invoice_accounting", "receipts", "customer_ledger", "invoice_audit_logs",
] as const;
const ALL_TABLES = [...COPY_TABLES, "invoice_attachments", "otp_codes", "sync_queue", "company_settings"] as const;
const TIMESTAMPS = new Set([
  "clients.created_at", "clients.updated_at", "users.created_at",
  "invoice_item_templates.created_at", "invoices.created_at", "invoices.updated_at",
  "invoices.deleted_at", "receipts.created_at", "receipts.deleted_at",
]);
const BOOLEANS = new Set([
  "users.is_active", "users.pending_approval", "users.two_factor_email",
  "users.two_factor_whatsapp", "invoice_accounting.transportation_paid",
  "invoice_accounting.labor_paid", "invoice_accounting.other_expenses_paid",
]);

function quote(name: string) { return `"${name}"`; }

export function convertInternalValue(table: string, column: string, value: unknown) {
  if (value == null) return null;
  const key = `${table}.${column}`;
  if (key === "customer_ledger.created_at" && typeof value === "string" && !/^\d+(?:\.\d+)?$/.test(value)) {
    const date = Date.parse(value.includes("T") ? value : `${value.replace(" ", "T")}Z`);
    if (!Number.isFinite(date)) throw new Error(`Invalid date in ${key}`);
    return new Date(date).toISOString();
  }
  if (TIMESTAMPS.has(key)) {
    const date = typeof value === "number" ? new Date(value) : new Date(String(value));
    if (!Number.isFinite(date.getTime())) throw new Error(`Invalid date in ${key}`);
    return date.toISOString();
  }
  if (BOOLEANS.has(key)) return Boolean(value);
  return value;
}

export async function bootstrapInternalDatabase(connectionString: string) {
  if (!sqlite) throw new Error("SQLite database is unavailable");
  // Freeze the source in memory before the first write to PostgreSQL.
  const source = COPY_TABLES.map((table) => ({
    name: table,
    rows: sqlite.prepare(`SELECT * FROM ${quote(table)} ORDER BY id`).all() as Array<Record<string, unknown>>,
  }));
  const client = new Client({ connectionString, connectionTimeoutMillis: 5000 });
  let inTransaction = false;
  try {
    await client.connect();
    await client.query("BEGIN");
    inTransaction = true;
    await client.query("SET LOCAL statement_timeout = '30s'");
    // Two simultaneous bootstrap requests cannot both pass the empty check.
    await client.query("SELECT pg_advisory_xact_lock(68291301)");
    for (const table of ALL_TABLES) {
      const result = await client.query(`SELECT COUNT(*) AS count FROM public.${quote(table)}`);
      if (Number(result.rows[0].count) !== 0) {
        throw new Error(`Internal database must be empty before initial transfer (${table})`);
      }
    }
    const transferred: Array<{ name: string; count: number }> = [];
    for (const { name, rows } of source) {
      const metadata = await client.query(
        "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1",
        [name],
      );
      const columns = new Set(metadata.rows.map((item) => String(item.column_name)));
      const sourceColumns = (sqlite.prepare(`PRAGMA table_info(${quote(name)})`).all() as Array<{ name: string }>).map((item) => item.name);
      const missing = sourceColumns.filter((column) => !columns.has(column));
      if (missing.length) throw new Error(`Missing internal columns in ${name}: ${missing.join(", ")}`);
      for (const row of rows) {
        const values = sourceColumns.map((column) => convertInternalValue(name, column, row[column]));
        const placeholders = sourceColumns.map((_, index) => `$${index + 1}`).join(", ");
        await client.query(
          `INSERT INTO public.${quote(name)} (${sourceColumns.map(quote).join(", ")}) VALUES (${placeholders})`,
          values,
        );
      }
      if (rows.length) {
        await client.query(
          `SELECT setval(pg_get_serial_sequence('public.${name}', 'id'), (SELECT MAX(id) FROM public.${quote(name)}))`,
        );
      }
      const verified = await client.query(`SELECT COUNT(*) AS count FROM public.${quote(name)}`);
      if (Number(verified.rows[0].count) !== rows.length) throw new Error(`Count mismatch in ${name}`);
      transferred.push({ name, count: rows.length });
    }
    await client.query("COMMIT");
    inTransaction = false;
    return {
      transferred,
      excluded: ["invoice_attachments", "otp_codes", "sync_queue", "company_settings"],
    };
  } catch (error) {
    if (inTransaction) await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    await client.end().catch(() => undefined);
  }
}

// Repairs an earlier bootstrap that omitted accounting rows whose invoices
// had been deleted. Existing PostgreSQL rows are left untouched.
export async function completeInternalAccounting(connectionString: string) {
  if (!sqlite) throw new Error("SQLite database is unavailable");
  const rows = sqlite.prepare("SELECT * FROM invoice_accounting ORDER BY id").all() as Array<Record<string, unknown>>;
  const columns = (sqlite.prepare('PRAGMA table_info("invoice_accounting")').all() as Array<{ name: string }>).map((item) => item.name);
  const client = new Client({ connectionString, connectionTimeoutMillis: 5000 });
  let inTransaction = false;
  try {
    await client.connect();
    await client.query("BEGIN");
    inTransaction = true;
    await client.query("SET LOCAL statement_timeout = '30s'");
    await client.query("SELECT pg_advisory_xact_lock(68291301)");
    const insertedIds: number[] = [];
    for (const row of rows) {
      const values = columns.map((column) => convertInternalValue("invoice_accounting", column, row[column]));
      const inserted = await client.query(
        `INSERT INTO public.invoice_accounting (${columns.map(quote).join(", ")}) ` +
        `VALUES (${columns.map((_, index) => `$${index + 1}`).join(", ")}) ` +
        "ON CONFLICT (id) DO NOTHING RETURNING id",
        values,
      );
      if (inserted.rows.length) insertedIds.push(Number(inserted.rows[0].id));
    }
    const count = await client.query("SELECT COUNT(*) AS count FROM public.invoice_accounting");
    const internalCount = Number(count.rows[0].count);
    if (internalCount !== rows.length) throw new Error(`Accounting count mismatch: local ${rows.length}, internal ${internalCount}`);
    if (rows.length) {
      await client.query("SELECT setval(pg_get_serial_sequence('public.invoice_accounting', 'id'), (SELECT MAX(id) FROM public.invoice_accounting))");
    }
    await client.query("COMMIT");
    inTransaction = false;
    return { localCount: rows.length, internalCount, insertedIds };
  } catch (error) {
    if (inTransaction) await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    await client.end().catch(() => undefined);
  }
}
