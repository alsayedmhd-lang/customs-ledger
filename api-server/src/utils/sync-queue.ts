import { sqlite } from "@workspace/db";
import { ensureSyncQueueTable } from "./ensure-sync-queue-table";

type SyncEntityType = string;
type SyncEntityId = string | number;
type SyncAction = string;

type EnqueueSyncChangeInput = {
  entityType: SyncEntityType;
  entityId: SyncEntityId;
  action: SyncAction;
  payload?: unknown;
  userId?: number | string | null;
};

export async function enqueueSyncChange({ entityType, entityId, action, payload, userId }: EnqueueSyncChangeInput): Promise<void> {
  if (!sqlite) throw new Error("SQLite unavailable for sync queue");
  ensureSyncQueueTable();
  const now = Date.now();
  try {
    sqlite.prepare(`INSERT INTO sync_queue(entity_type,entity_id,operation,payload_json,status,retry_count,created_at,updated_at)
      VALUES(?,?,?,?,'pending',0,?,?)`).run(entityType, String(entityId), action,
      JSON.stringify({ ...(payload && typeof payload === "object" ? payload : {value:payload ?? null}), userId:userId ?? null }), now, now);
    console.log("Sync change queued", { entityType, entityId, action });
  } catch (err) {
    console.error("Failed to enqueue sync change", { entityType, entityId, action, err });
    throw err;
  }
}
