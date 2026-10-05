import { ensureLocalTemplateNumbers, ensurePgTemplateNumbers } from "./template-numbering";
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

export async function runInternalBidirectionalOnce(connectionString: string) {
  if (inFlight || pullInFlight) throw new Error("An internal sync is already in progress");
  pullInFlight = true;
  try {
    const pushed = await performInternalPush(connectionString, true);
    let pulled;
    try {
      // Direct PostgreSQL edits use the server journal. SQLite pushes from
      // other devices do not, so refresh all rows after consuming the journal.
      const journal = await performInternalJournalPull(connectionString);
      const refreshed = await performInternalPull(connectionString);
      pulled = {
        processed: journal.processed + refreshed.inserted + refreshed.updated,
        inserted: journal.inserted + refreshed.inserted,
        updated: journal.updated + refreshed.updated,
      };
    } catch (error) {
      throw new Error(`Local push completed (${pushed.processed} events), but server pull failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    return { pushed, pulled };
  } finally {
    pullInFlight = false;
  }
}

export function runInternalLocalToServerOnce(connectionString: string) {
  if (pullInFlight) throw new Error("An internal server pull is in progress");
  if (inFlight) return inFlight;
  inFlight = performInternalPush(connectionString).finally(() => { inFlight = null; });
  return inFlight;
}

// The server is authoritative only when this direction is selected. The
// journal gate prevents overwriting local changes that have not been sent.
// Complete invoice line lists include removals; absence in other business
// tables is not treated as a deletion.
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
  ensureLocalTemplateNumbers();
  ensureInternalSyncJournal();
  if (!sqlite) throw new Error("SQLite database is unavailable");
  const pending = sqlite.prepare("SELECT COUNT(*) AS count FROM internal_sync_journal").get() as { count: number };
  if (pending.count) throw new Error(`Send ${pending.count} pending local changes before pulling from the internal server`);
  const client = new Client({ connectionString, connectionTimeoutMillis: 5000 });
  let inPgTransaction = false;
  const source: Array<{ name: string; columns: Array<{ name: string; type: string }>; rows: Array<Record<string, unknown>> }> = [];
  try {
    await client.connect();
    await ensurePgTemplateNumbers(client, false);
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

  return applyInternalSource(source, true);
}

function applyInternalSource(source: Array<{
  name: string;
  columns: Array<{ name: string; type: string }>;
  rows: Array<Record<string, unknown>>;
}>, fullSnapshot = false) {
  if (!sqlite) throw new Error("SQLite database is unavailable");
  // better-sqlite3 transactions are synchronous. This second check closes
  // the gap between fetching the server snapshot and writing to SQLite.
  return sqlite.transaction(() => {
    const current = sqlite!.prepare("SELECT COUNT(*) AS count FROM internal_sync_journal").get() as { count: number };
    if (current.count) throw new Error(`Local changes appeared during pull (${current.count}); send them first`);
    let inserted = 0;
    let updated = 0;
    sqlite!.prepare("UPDATE internal_sync_control SET capture_enabled = 0 WHERE id = 1").run();
    if (fullSnapshot) {
      const items = source.find(table => table.name === "invoice_items");
      const invoices = source.find(table => table.name === "invoices");
      if (!items || !invoices) throw new Error("Incomplete internal invoice snapshot");
      const remoteIds = new Set(items.rows.map(row => Number(row.id)));
      const invoiceIds = new Set(invoices.rows.map(row => Number(row.id)));
      // A complete server invoice owns its complete line list. An absent line
      // is a deletion, not an invitation to merge an older Online ID batch.
      for (const local of sqlite!.prepare("SELECT id,invoice_id FROM invoice_items").all() as Array<{id:number;invoice_id:number}>) {
        if (invoiceIds.has(local.invoice_id) && !remoteIds.has(local.id)) {
          sqlite!.prepare("DELETE FROM invoice_items WHERE id=?").run(local.id);
        }
      }
    }
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
        if (table.name === "invoice_item_templates") {
          const code = String(remote.item_code ?? "").trim();
          const description = String(remote.description ?? "").trim();
          if (!code || !description) throw new Error("Internal template identity is incomplete");
          const matches = sqlite!.prepare(
            "SELECT * FROM invoice_item_templates WHERE item_code = ?"
          ).all(code) as Array<Record<string, unknown>>;
          if (matches.length > 1) throw new Error(`Duplicate internal template code: ${code}`);
          const localTemplate = matches[0];
          const duplicates = sqlite!.prepare("SELECT id, item_code FROM invoice_item_templates WHERE LOWER(TRIM(description)) = LOWER(TRIM(?))").all(description) as Array<{id:number;item_code:string|null}>;
          if (duplicates.some(row => row.item_code && row.item_code !== code)) {
            throw new Error(`Internal template description has another code: ${description}`);
          }
          const columns = table.columns.filter(column => column.name !== "id");
          if (localTemplate?.display_code != null && remote.display_code != null && Number(localTemplate.display_code) !== Number(remote.display_code)) throw new Error(`Internal template number conflict: ${code}`);
          const values = columns.map(({name,type}) => name === "display_code" && remote[name] == null && localTemplate?.display_code != null ? localTemplate.display_code : fromInternalValue(table.name,name,type,remote[name]));
          if (localTemplate) {
            if (columns.some(({name},index) => localTemplate[name] !== values[index])) {
              sqlite!.prepare(`UPDATE invoice_item_templates SET ${columns.map(({name}) => `${quote(name)} = ?`).join(", ")} WHERE id = ?`).run(...values,localTemplate.id);
              updated++;
            }
          } else {
            sqlite!.prepare(`INSERT INTO invoice_item_templates (${columns.map(({name}) => quote(name)).join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`).run(...values);
            inserted++;
          }
          continue;
        }
        const id = remote.id;
        const local = select.get(id) as Record<string, unknown> | undefined;
        if (local && table.name === "invoice_items" && Number(local.invoice_id) !== Number(remote.invoice_id)) {
          throw new Error(`Internal invoice item ID collision: ${id}; no local changes applied`);
        }
        if (local && table.name === "invoices" && String(local.invoice_number) !== String(remote.invoice_number)) {
          throw new Error(`Internal invoice ID collision: ${id}; no local changes applied`);
        }
        if (table.name === "users") {
          const remoteUsername = String(remote.username ?? "").trim().toLowerCase();
          const remoteSyncId = remote.user_sync_id == null ? "" : String(remote.user_sync_id).trim();

          if (!remoteUsername || !remoteSyncId) {
            throw new Error(`Internal user identity is incomplete: id ${id}`);
          }

          if (local) {
            const localUsername = String(local.username ?? "").trim().toLowerCase();
            const localSyncId = local.user_sync_id == null ? "" : String(local.user_sync_id).trim();

            if (localUsername !== remoteUsername ||
                (localSyncId && localSyncId !== remoteSyncId)) {
              throw new Error(`Internal user identity conflict: id ${id}`);
            }
          }

          const existingIdentity = sqlite!.prepare(
            `SELECT id, username FROM users WHERE user_sync_id = ? OR LOWER(TRIM(username)) = ?`,
          ).all(remoteSyncId, remoteUsername) as Array<{ id: number; username: string }>;

          if (existingIdentity.some((user) => Number(user.id) !== Number(id))) {
            throw new Error(`Internal user identity belongs to another local id: ${id}`);
          }
        }
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

async function performInternalJournalPull(connectionString: string) {
  ensureLocalTemplateNumbers();
  ensureInternalSyncJournal();
  if (!sqlite) throw new Error("SQLite database is unavailable");
  const pending = sqlite.prepare("SELECT COUNT(*) AS count FROM internal_sync_journal").get() as { count: number };
  if (pending.count) throw new Error(`Local changes appeared during bidirectional sync (${pending.count}); retry after sending them`);
  const client = new Client({ connectionString, connectionTimeoutMillis: 5000 });
  let transaction = false;
  let watermark = 0;
  const source: Array<{ name: string; columns: Array<{ name: string; type: string }>; rows: Array<Record<string, unknown>> }> = [];
  try {
    await client.connect();
    await ensurePgTemplateNumbers(client, false);
    await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    transaction = true;
    await client.query("SET LOCAL statement_timeout = '30s'");
    const result = await client.query(
      "SELECT id, table_name, row_id, operation FROM public.internal_sync_journal ORDER BY id LIMIT 500",
    );
    const changes = result.rows as Array<{ id: string; table_name: string; row_id: number; operation: string }>;
    if (changes.length) {
      watermark = Number(changes[changes.length - 1].id);
      const valid = new Set<string>(TABLES);
      const ids = new Map<string, Set<number>>();
      for (const change of changes) {
        if (!valid.has(change.table_name)) throw new Error(`Unknown server journal table: ${change.table_name}`);
        if (!ids.has(change.table_name)) ids.set(change.table_name, new Set());
        ids.get(change.table_name)!.add(change.row_id);
      }
      for (const table of TABLES) {
        if (table === "invoice_items") continue;
        const columns = sqlite.prepare(`PRAGMA table_info(${quote(table)})`).all() as Array<{ name: string; type: string }>;
        const rows: Array<Record<string, unknown>> = [];
        for (const id of ids.get(table) || []) {
          const row = await client.query(`SELECT ${columns.map(({ name }) =>
            TIMESTAMP_COLUMNS.has(`${table}.${name}`) ? `${quote(name)}::text AS ${quote(name)}` : quote(name)
          ).join(", ")} FROM public.${quote(table)} WHERE id = $1`, [id]);
          if (!row.rows.length) throw new Error(`Server deletion needs manual resolution: ${table} id ${id}`);
          rows.push(row.rows[0]);
        }
        source.push({ name: table, columns, rows });
      }
    }
    await client.query("COMMIT");
    transaction = false;
    if (!watermark) return { processed: 0, inserted: 0, updated: 0 };
    const applied = applyInternalSource(source);
    // A concurrent server transaction can commit an older sequence ID after
    // our snapshot. Acknowledge only the IDs actually read in this run.
    await client.query("DELETE FROM public.internal_sync_journal WHERE id = ANY($1::bigint[])",
      [changes.map(({ id }) => id)]);
    return { processed: changes.length, inserted: applied.inserted, updated: applied.updated };
  } catch (error) {
    if (transaction) await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function performInternalPush(connectionString: string, bidirectional = false) {
  ensureLocalTemplateNumbers();
  ensureInternalSyncJournal();
  if (!sqlite) throw new Error("SQLite database is unavailable");
  const sqliteDb = sqlite;
  const changes = sqliteDb.prepare(`
    SELECT id, table_name AS tableName, row_id AS rowId, invoice_id AS invoiceId, item_code AS itemCode
    FROM internal_sync_journal ORDER BY id LIMIT 500
  `).all() as Array<{ id: number; tableName: string; rowId: number; invoiceId: number | null; itemCode: string | null }>;
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
    columns: (sqliteDb.prepare(`PRAGMA table_info(${quote(table)})`).all() as Array<{ name: string }>).map((item) => item.name),
    rows: [...(rowIds.get(table) || [])].map((id) => ({
      id,
      row: sqliteDb.prepare(`SELECT * FROM ${quote(table)} WHERE id = ?`).get(id) as Record<string, unknown> | undefined,
    })),
  }));
  const client = new Client({ connectionString, connectionTimeoutMillis: 5000 });
  let inTransaction = false;
  try {
    await client.connect();
    await ensurePgTemplateNumbers(client, false);
    await client.query("BEGIN");
    inTransaction = true;
    await client.query("SET LOCAL statement_timeout = '30s'");
    await client.query("SELECT pg_advisory_xact_lock(68291301)");
    if (snapshot.some(table => table.name === "invoice_item_templates" && table.rows.length)) {
      await client.query("LOCK TABLE public.invoice_item_templates IN SHARE ROW EXCLUSIVE MODE");
    }
    if (bidirectional) {
      // Lock business tables before checking the remote journal so a server
      // writer cannot slip an edit between conflict detection and our upsert.
      await client.query(`LOCK TABLE ${TABLES.map((table) => `public.${quote(table)}`).join(", ")} IN SHARE ROW EXCLUSIVE MODE`);
      const remote = await client.query("SELECT table_name, row_id FROM public.internal_sync_journal");
      const localKeys = new Set(changes.map(({ tableName, rowId }) => `${tableName}:${rowId}`));
      const conflicts: Array<Record<string, unknown>> = [];
      for (const change of remote.rows.filter(row => row.table_name !== "invoice_item_templates" && localKeys.has(`${row.table_name}:${row.row_id}`))) {
        const table = snapshot.find(table => table.name === change.table_name);
        if (!table) throw new Error("Unknown internal conflict table");
        const local = table.rows.find(row => row.id === Number(change.row_id))?.row;
        const columns = sqliteDb.prepare(`PRAGMA table_info(${quote(table.name)})`).all() as Array<{name:string;type:string}>;
        const server = await client.query(`SELECT ${columns.map(({name}) =>
          TIMESTAMP_COLUMNS.has(`${table.name}.${name}`) ? `${quote(name)}::text AS ${quote(name)}` : quote(name)
        ).join(", ")} FROM public.${quote(table.name)} WHERE id=$1`, [change.row_id]);
        const remoteRow = server.rows[0];
        // The same repair/delete may have been applied on both devices and
        // the server. Converged records are acknowledgements, not conflicts.
        const identical = !local && !remoteRow || Boolean(local && remoteRow && columns.every(({name,type}) => {
          const value = fromInternalValue(table.name,name,type,remoteRow[name]);
          if (local![name] === value) return true;
          if (name === "permissions" || name === "client_view_permissions") {
            try { return canonicalJson(JSON.parse(String(local![name]))) === canonicalJson(remoteRow[name]); } catch { return false; }
          }
          return false;
        }));
        if (!identical) conflicts.push(change);
      }
      if (conflicts.length) throw new Error(`Internal sync conflict in ${conflicts.length} record(s); no local changes were sent`);
    }
    // PostgreSQL's journal must record independent server edits, not changes
    // that this worker is already delivering from SQLite.
    await client.query("SELECT set_config('ledger.internal_sync_origin', 'local', true)");
    // Children are removed first; parent rows are inserted first.
    for (const table of [...snapshot].reverse()) {
      for (const { id, row } of table.rows) {
        if (!row) {
          if (table.name === "invoice_item_templates") {
            const event = [...changes].reverse().find(change => change.tableName === table.name && change.rowId === id);
            const code = String(event?.itemCode ?? "").trim();
            if (!code) throw new Error(`Legacy template deletion has no code: ${id}; manual resolution required`);
            const remote = await client.query("SELECT id FROM public.invoice_item_templates WHERE item_code=$1 FOR UPDATE", [code]);
            if (remote.rows.length > 1) throw new Error(`Duplicate server template code: ${code}`);
            if (remote.rows.length) {
              const pending = await client.query("SELECT id FROM public.internal_sync_journal WHERE table_name='invoice_item_templates' AND row_id=$1 LIMIT 1", [remote.rows[0].id]);
              if (pending.rows.length) throw new Error(`Server template changed before deletion: ${code}`);
              await client.query("DELETE FROM public.invoice_item_templates WHERE item_code=$1", [code]);
            }
          } else if (table.name === "invoice_items") {
            const existing = await client.query("SELECT invoice_id FROM public.invoice_items WHERE id=$1 FOR UPDATE", [id]);
            if (!existing.rows.length) continue;
            const event = [...changes].reverse().find(change => change.tableName === table.name && change.rowId === id);
            if (event?.invoiceId == null || Number(existing.rows[0].invoice_id) !== Number(event.invoiceId)) {
              throw new Error(`Invoice item deletion identity is unresolved: ${id}; no changes sent`);
            }
            await client.query("DELETE FROM public.invoice_items WHERE id=$1 AND invoice_id=$2", [id,event.invoiceId]);
          } else {
            await client.query(`DELETE FROM public.${quote(table.name)} WHERE id = $1`, [id]);
          }
        }
      }
    }
    for (const table of snapshot) {
      for (const { row } of table.rows) {
        if (!row) continue;
        if (table.name === "invoice_item_templates") {
          const code = String(row.item_code ?? "").trim();
          const description = String(row.description ?? "").trim();
          if (!code || !description) throw new Error("Local template identity is incomplete");
          const existing = await client.query("SELECT * FROM public.invoice_item_templates WHERE item_code=$1 FOR UPDATE", [code]);
          if (existing.rows.length > 1) throw new Error(`Duplicate server template code: ${code}`);
          const duplicateDescription = await client.query("SELECT item_code FROM public.invoice_item_templates WHERE LOWER(TRIM(description))=LOWER(TRIM($1)) FOR UPDATE", [description]);
          if (duplicateDescription.rows.some(other => other.item_code && String(other.item_code) !== code)) throw new Error(`Server template description has another code: ${description}`);
          const remoteTemplate = existing.rows[0];
          const columns = table.columns.filter(column => column !== "id");
          const values = columns.map(column => convertInternalValue(table.name,column,row[column]));
          if (remoteTemplate) {
            const pending = await client.query("SELECT id FROM public.internal_sync_journal WHERE table_name='invoice_item_templates' AND row_id=$1 LIMIT 1", [remoteTemplate.id]);
            const same = String(remoteTemplate.description) === String(row.description) && Number(remoteTemplate.default_unit_price ?? 0) === Number(row.default_unit_price ?? 0);
            if (pending.rows.length && !same) throw new Error(`Internal template edit conflict: ${code}; no changes sent`);
            if (row.display_code != null && remoteTemplate.display_code != null && Number(row.display_code) !== Number(remoteTemplate.display_code)) throw new Error(`Internal template number conflict: ${code}`);
            if (row.display_code != null && remoteTemplate.display_code == null) {
              await client.query("UPDATE public.invoice_item_templates SET display_code=$1 WHERE item_code=$2",[row.display_code,code]);
            }
            if (!same) {
              // Preserve original creation date and shared code on edits.
              await client.query("UPDATE public.invoice_item_templates SET description=$1, default_unit_price=$2 WHERE item_code=$3", [description,row.default_unit_price,code]);
            }
          } else {
            await client.query(`INSERT INTO public.invoice_item_templates (${columns.map(quote).join(", ")}) VALUES (${columns.map((_,index) => `$${index+1}`).join(", ")})`,values);
          }
          continue;
        }
        const values = table.columns.map((column) => convertInternalValue(table.name, column, row[column]));
        if (table.name === "invoice_items" || table.name === "invoices") {
          const identityColumn = table.name === "invoice_items" ? "invoice_id" : "invoice_number";
          const existing = await client.query(`SELECT ${quote(identityColumn)} FROM public.${quote(table.name)} WHERE id=$1 FOR UPDATE`, [row.id]);
          if (existing.rows.length && String(existing.rows[0][identityColumn]) !== String(row[identityColumn])) {
            throw new Error(`Internal ${table.name} ID collision: ${row.id}; no local changes sent`);
          }
        }
        if (table.name === "users") {
          const localUsername = String(row.username ?? "").trim().toLowerCase();
          const localSyncId = row.user_sync_id == null ? "" : String(row.user_sync_id).trim();

          if (!localUsername || !localSyncId) {
            throw new Error(`Local user identity is incomplete: id ${row.id}`);
          }

          const identity = await client.query(
            `SELECT id, username, user_sync_id FROM public.users
             WHERE id = $1 OR LOWER(TRIM(username)) = $2 OR user_sync_id = $3
             FOR UPDATE`,
            [row.id, localUsername, localSyncId],
          );

          for (const remote of identity.rows) {
            const remoteUsername = String(remote.username ?? "").trim().toLowerCase();
            const remoteSyncId = remote.user_sync_id == null ? "" : String(remote.user_sync_id).trim();

            if (Number(remote.id) !== Number(row.id) ||
                remoteUsername !== localUsername ||
                (remoteSyncId && remoteSyncId !== localSyncId)) {
              throw new Error(`Internal user identity conflict: id ${row.id}`);
            }
          }
        }
        const updates = table.columns.filter((column) => column !== "id")
          .map((column) => table.name === "users" && column === "user_sync_id"
            ? `"user_sync_id" = COALESCE(public."users"."user_sync_id", EXCLUDED."user_sync_id")`
            : `${quote(column)} = EXCLUDED.${quote(column)}`).join(", ");
        const identityGuard = table.name === "users"
          ? ` WHERE public."users"."user_sync_id" IS NULL ` +
            `OR EXCLUDED."user_sync_id" IS NULL ` +
            `OR public."users"."user_sync_id" = EXCLUDED."user_sync_id"`
          : "";
        await client.query(
          `INSERT INTO public.${quote(table.name)} (${table.columns.map(quote).join(", ")}) ` +
          `VALUES (${table.columns.map((_, index) => `$${index + 1}`).join(", ")}) ` +
          `ON CONFLICT (id) DO UPDATE SET ${updates}${identityGuard}`,
          values,
        );
      }
      if (table.name !== "invoice_item_templates" && table.rows.some(({ row }) => Boolean(row))) {
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
