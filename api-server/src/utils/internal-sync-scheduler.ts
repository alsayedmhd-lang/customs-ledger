import { sqlite } from "@workspace/db";
import {
  pushAttachmentMetadataToInternalServer,
  pullAttachmentMetadataFromInternalServer,
} from "./internal-attachment-metadata-sync";
import {
  runInternalBidirectionalOnce,
  runInternalLocalToServerOnce,
  runInternalServerToLocalOnce,
} from "./internal-sync-worker";

type Settings = {
  enabled: number;
  onlineAutoSync: number;
  databaseMode: string;
  timing: string;
  minutes: number;
  mode: string;
  connectionString: string;
  host: string;
  port: string;
  databaseName: string;
  username: string;
  password: string;
};

let started = false;
let running = false;
let configuration = "";
let lastAttempt = 0;
let lastSuccess = 0;
let lastError = "";
let lastCheck = 0;

function readSettings(): Settings | undefined {
  if (!sqlite) return;
  return sqlite.prepare(`
    SELECT internal_sync_auto_sync AS enabled,
           sync_auto_sync AS onlineAutoSync, database_mode AS databaseMode,
           internal_sync_timing AS timing,
           internal_sync_interval_minutes AS minutes,
           internal_sync_mode AS mode,
           internal_database_connection_string AS connectionString,
           internal_database_host AS host,
           internal_database_port AS port,
           internal_database_name AS databaseName,
           internal_database_username AS username,
           internal_database_password AS password
    FROM company_settings LIMIT 1
  `).get() as Settings | undefined;
}

function connectionFor(settings: Settings): string {
  if (settings.connectionString?.trim()) {
    const value = settings.connectionString.trim();
    if (!/^postgres(?:ql)?:\/\//i.test(value)) throw new Error("Invalid internal PostgreSQL connection string");
    return value;
  }
  if (!settings.host?.trim() || !settings.databaseName?.trim() || !settings.username?.trim()) {
    throw new Error("Internal server settings are incomplete");
  }
  const url = new URL("postgresql://localhost");
  url.hostname = settings.host.trim();
  url.port = String(settings.port || "5432");
  url.pathname = `/${encodeURIComponent(settings.databaseName.trim())}`;
  url.username = settings.username.trim();
  url.password = settings.password || "";
  return url.toString();
}

async function runConfigured(settings: Settings) {
  const connectionString = connectionFor(settings);
  for (let pass = 0; pass < 20; pass++) {
    if (settings.mode === "local-to-internal") {
      const result = await runInternalLocalToServerOnce(connectionString);
      if (result.processed < 500) return;
    } else if (settings.mode === "internal-to-local") {
      await runInternalServerToLocalOnce(connectionString);
      return;
    } else if (settings.mode === "bidirectional") {
      const result = await runInternalBidirectionalOnce(connectionString);
      if (result.pushed.processed < 500 && result.pulled.processed < 500) return;
    } else {
      throw new Error("Invalid internal sync direction");
    }
  }
  throw new Error("Internal sync batch limit reached; run again to finish remaining changes");
}

async function runConfiguredWithAttachments(settings: Settings) {
  // Complete regular data synchronization first.
  await runConfigured(settings);

  const connectionString = connectionFor(settings);

  if (settings.mode === "local-to-internal") {
    await pushAttachmentMetadataToInternalServer(connectionString);
  } else if (settings.mode === "internal-to-local") {
    await pullAttachmentMetadataFromInternalServer(connectionString);
  } else if (settings.mode === "bidirectional") {
    await pullAttachmentMetadataFromInternalServer(connectionString);
    await pushAttachmentMetadataToInternalServer(connectionString);
  }
}
async function tick() {
  lastCheck = Date.now();
  if (running) return;
  let settings: Settings | undefined;
  try {
    settings = readSettings();
  } catch (error) {
    console.warn("[INTERNAL_SYNC][AUTO] Settings unavailable", error);
    return;
  }
  if (!settings || !settings.enabled || (settings.databaseMode === "online" && settings.onlineAutoSync)) {
    configuration = "";
    lastAttempt = 0;
    lastSuccess = 0;
    lastError = "";
    return;
  }
  const key = JSON.stringify(settings);
  if (key !== configuration) {
    configuration = key;
    lastAttempt = 0;
    lastSuccess = 0;
    lastError = "";
  }
  const interval = Math.max(1, Math.min(1440, Number(settings.minutes) || 30)) * 60_000;
  if (lastAttempt && (settings.timing === "startup" || Date.now() - lastAttempt < interval)) return;
  running = true;
  lastAttempt = Date.now();
  try {
    await runConfiguredWithAttachments(settings);
    lastSuccess = Date.now();
    lastError = "";
    console.info("[INTERNAL_SYNC][AUTO] Completed", { mode: settings.mode });
  } catch (error) {
    lastError = (error instanceof Error ? error.message : String(error))
      .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "[masked-connection-string]").slice(0, 250);
    console.warn("[INTERNAL_SYNC][AUTO] Failed", lastError);
  } finally {
    running = false;
  }
}

export function startInternalSyncScheduler() {
  if (started || !sqlite) return;
  started = true;
  setTimeout(() => { void tick(); }, 5000);
  setInterval(() => { void tick(); }, 10_000);
}

export function checkInternalSyncScheduleNow() {
  void tick();
}

export function getInternalAutoSyncStatus() {
  return {
    running,
    lastCheckAt: lastCheck ? new Date(lastCheck).toISOString() : null,
    lastAttemptAt: lastAttempt ? new Date(lastAttempt).toISOString() : null,
    lastSuccessAt: lastSuccess ? new Date(lastSuccess).toISOString() : null,
    lastError: lastError || null,
  };
}
