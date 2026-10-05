import { syncCooldownDeadline, isSyncOperationRunning } from "./sync-operation-lock";
import { sqlite } from "@workspace/db";
import { runConfiguredSyncOnce, isOnlineSyncRunning } from "./sync-worker";

import { getInternalAutoSyncStatus } from "./internal-sync-scheduler";

type Settings = {
  enabled: number; timing: string; minutes: number; mode: string;
  databaseMode: string; internalAutoSync: number;
};
let started = false;
let running = false;
let configuration = "";
let nextRunAt: number | null = null;
let initialRunAt = 0;
let wakeTimer: ReturnType<typeof setTimeout> | null = null;

function readSettings(): Settings | undefined {
  return sqlite?.prepare(`
    SELECT sync_auto_sync AS enabled, sync_timing AS timing,
           sync_interval_minutes AS minutes, sync_mode AS mode,
           database_mode AS databaseMode, internal_sync_auto_sync AS internalAutoSync
    FROM company_settings LIMIT 1
  `).get() as Settings | undefined;
}
function scheduleWake() {
  if (wakeTimer) clearTimeout(wakeTimer);
  wakeTimer = null;
  if (started && nextRunAt !== null) {
    wakeTimer = setTimeout(() => { wakeTimer = null; void tick(); }, Math.max(0, nextRunAt - Date.now()));
  }
}
function readPlan() {
  const settings = readSettings();
  const intervalMinutes = Math.max(10, Math.min(1440, Number(settings?.minutes) || 30));
  const scheduleEnabled = Boolean(settings?.enabled && settings.databaseMode === "online" && !settings.internalAutoSync && settings.timing === "interval");
  if (!scheduleEnabled) {
    configuration = "";
    nextRunAt = null;
    if (wakeTimer) clearTimeout(wakeTimer);
    wakeTimer = null;
  } else {
    const key = JSON.stringify(settings);
    if (key !== configuration) {
      configuration = key;
      nextRunAt = Math.max(Date.now(), initialRunAt);
      scheduleWake();
    }
  }
  if (scheduleEnabled) nextRunAt = syncCooldownDeadline("online") || nextRunAt;
  return { settings, intervalMinutes, scheduleEnabled };
}
export function getOnlineSyncScheduleStatus() {
  const plan = readPlan();
  return {
    serverTime: Date.now(), nextRunAt: isSyncOperationRunning() ? null : nextRunAt,
    intervalMinutes: plan.intervalMinutes,
    timing: plan.settings?.timing || "startup",
    scheduleEnabled: plan.scheduleEnabled,
  };
}
// Manual sync uses the same deadline as the automatic scheduler.
export function recordOnlineSyncAttempt() {
  const plan = readPlan();
  if (plan.scheduleEnabled) {
    nextRunAt = syncCooldownDeadline("online") || nextRunAt;
    scheduleWake();
  }
}
async function tick() {
  if (!sqlite || running || isOnlineSyncRunning()) return;
  try {
    if (getInternalAutoSyncStatus().running) return;
    const plan = readPlan();
    if (!plan.scheduleEnabled || !plan.settings || nextRunAt === null || Date.now() < nextRunAt) return;
    running = true;
    const result = await runConfiguredSyncOnce(plan.settings.mode);
    sqlite.prepare("UPDATE company_settings SET sync_status = ?, sync_last_sync_time = ?")
      .run(result.lastError ? "failed" : "success", result.lastError ? "" : new Date().toISOString());
    if (result.lastError) console.warn("[SYNC][AUTO]", result.lastError);
  } catch (error) {
    console.error("[SYNC][AUTO][ERROR]", error);
    try { sqlite?.prepare("UPDATE company_settings SET sync_status = 'failed'").run(); } catch { /* Already logged. */ }
  } finally {
    running = false;
    try { recordOnlineSyncAttempt(); } catch { /* Retry on the next scheduler poll. */ }
  }
}
export function startOnlineSyncScheduler() {
  if (started || !sqlite) return;
  started = true;
  initialRunAt = Date.now() + 5000;
  try { readPlan(); } catch (error) { console.warn("[SYNC][AUTO] Settings unavailable", error); }
  // Detect saved configuration changes and retry when another sync was in flight.
  setInterval(() => { void tick(); }, 10_000);
}
