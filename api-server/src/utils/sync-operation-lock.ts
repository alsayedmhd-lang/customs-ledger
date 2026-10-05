import { AsyncLocalStorage } from "node:async_hooks";
import { createRequire } from "node:module";
import { sqlite } from "@workspace/db";

export type SyncTarget = "online" | "internal";
type Scope = { target: SyncTarget; connectionString: string; client: any; lost: boolean };
const scopes = new AsyncLocalStorage<Scope>();
const completed: Record<SyncTarget, number> = { online: 0, internal: 0 };
let active: SyncTarget | null = null;
const require = createRequire(process.cwd() + "/package.json");
const { Client } = require("pg");

export function isSyncOperationRunning() { return active !== null; }
export function manualSyncAvailableAt(target: SyncTarget): number {
  return completed[target] ? completed[target] + 5 * 60_000 : 0;
}

export function syncCooldownDeadline(target: SyncTarget): number {
  const row = sqlite?.prepare(`SELECT sync_auto_sync, sync_timing, sync_interval_minutes,
    internal_sync_auto_sync, internal_sync_timing, internal_sync_interval_minutes
    FROM company_settings ORDER BY id LIMIT 1`).get() as Record<string, unknown> | undefined;
  const prefix = target === "online" ? "sync" : "internal_sync";
  if (!row?.[`${prefix}_auto_sync`] || row[`${prefix}_timing`] !== "interval" || !completed[target]) return 0;
  return completed[target] + Math.max(10, Math.min(1440, Number(row[`${prefix}_interval_minutes`]) || 30)) * 60_000;
}

// Check the lock connection on each business connection at most every five seconds.
// Error/end events stop subsequent queries immediately without extra per-row traffic.
// The transaction also pins a backend when using PostgreSQL transaction pooling.
export function guardSyncClient(client: any) {
  const scope = scopes.getStore();
  if (!scope) return;
  const query = client.query.bind(client);
  let checkedAt = 0;
  client.query = async (...args: unknown[]) => {
    if (scope.lost) throw new Error("Synchronization lock connection was lost; retry later");
    try {
      if (Date.now() - checkedAt >= 5000) {
        await scope.client.query("SELECT 1");
        checkedAt = Date.now();
      }
    }
    catch { scope.lost = true; throw new Error("Synchronization lock connection was lost; retry later"); }
    return query(...args);
  };
}

export async function withSyncLock<T>(target: SyncTarget, connectionString: string, work: () => Promise<T>): Promise<T> {
  const nested = scopes.getStore();
  if (nested) {
    if (nested.target !== target || nested.connectionString !== connectionString || nested.lost) {
      throw new Error("Synchronization lock context does not match this operation");
    }
    return work();
  }
  if (active !== null) throw new Error("A synchronization operation is already running on this device");
  if (Date.now() < manualSyncAvailableAt(target)) throw new Error("Wait for the sync countdown to finish");
  if (!connectionString.trim()) throw new Error("Database connection is not configured");
  active = target; // Synchronous local gate, before any network await.
  let client: any;
  let scope: Scope;
  let transaction = false;
  try {
    client = new Client({ connectionString, connectionTimeoutMillis: 5000, query_timeout: 10000, keepAlive: true });
    scope = { target, connectionString, client, lost: false };
    client.on("error", () => { scope.lost = true; });
    client.on("end", () => { scope.lost = true; });
    await client.connect();
    await client.query("BEGIN");
    transaction = true;
    await client.query("SET LOCAL idle_in_transaction_session_timeout = 0");
    const result = await client.query("SELECT pg_try_advisory_xact_lock($1, $2) AS acquired", [68291304, target === "online" ? 1 : 2]);
    if (result.rows[0]?.acquired !== true) throw new Error("Another device is synchronizing this database; retry after the countdown");
    return await scopes.run(scope, work);
  } catch (error) {
    const message = (error instanceof Error ? error.message : String(error))
      .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "[masked-connection-string]").slice(0, 250);
    throw new Error(message);
  } finally {
    // On failures, a complete interval still avoids a rapid retry loop.
    if (transaction) await client.query("ROLLBACK").catch(() => undefined);
    if (client) await client.end().catch(() => undefined);
    completed[target] = Date.now();
    active = null;
  }
}
