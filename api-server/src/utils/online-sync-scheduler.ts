import { sqlite } from "@workspace/db";
import { runConfiguredSyncOnce } from "./sync-worker";

type Settings = {
  enabled: number;
  timing: string;
  minutes: number;
  mode: string;
  databaseMode: string;
  internalAutoSync: number;
};

let started = false;
let running = false;
let configuration = "";
let lastAttempt = 0;

async function tick() {
  if (!sqlite || running) return;
  let settings: Settings | undefined;
  try {
    settings = sqlite.prepare(`
      SELECT sync_auto_sync AS enabled, sync_timing AS timing,
             sync_interval_minutes AS minutes, sync_mode AS mode,
             database_mode AS databaseMode,
             internal_sync_auto_sync AS internalAutoSync
      FROM company_settings LIMIT 1
    `).get() as Settings | undefined;
  } catch (error) {
    console.warn("[SYNC][AUTO] Settings unavailable", error);
    return;
  }
  if (!settings || !settings.enabled || settings.databaseMode !== "online" || settings.internalAutoSync || settings.timing !== "interval") {
    configuration = "";
    lastAttempt = 0;
    return;
  }
  const key = JSON.stringify(settings);
  if (key !== configuration) {
    configuration = key;
    lastAttempt = 0;
  }
  const interval = Math.max(1, Math.min(1440, Number(settings.minutes) || 30)) * 60_000;
  if (lastAttempt && Date.now() - lastAttempt < interval) return;
  running = true;
  lastAttempt = Date.now();
  try {
    const result = await runConfiguredSyncOnce(settings.mode);
    sqlite.prepare("UPDATE company_settings SET sync_status = ?, sync_last_sync_time = ?")
      .run(result.lastError ? "failed" : "success", result.lastError ? "" : new Date().toISOString());
    if (result.lastError) console.warn("[SYNC][AUTO]", result.lastError);
  } catch (error) {
    console.error("[SYNC][AUTO][ERROR]", error);
    try { sqlite.prepare("UPDATE company_settings SET sync_status = 'failed'").run(); } catch { /* Log above. */ }
  } finally {
    running = false;
  }
}

export function startOnlineSyncScheduler() {
  if (started || !sqlite) return;
  started = true;
  setTimeout(() => { void tick(); }, 5000);
  setInterval(() => { void tick(); }, 10_000);
}
