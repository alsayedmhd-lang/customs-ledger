import { sqlite } from "@workspace/db";
import { ensureSyncQueueTable } from "./ensure-sync-queue-table";

export async function runSyncWorkerOnce(): Promise<{ pendingCount: number }> {
  try {
    ensureSyncQueueTable();

    if (!sqlite) {
      console.log("Sync worker pending items: 0");
      return { pendingCount: 0 };
    }

    const pending = sqlite
      .prepare(`
        SELECT id
        FROM sync_queue
        WHERE status = 'pending'
        ORDER BY created_at ASC, id ASC
        LIMIT 10
      `)
      .all() as Array<{ id: number }>;

    console.log(`Sync worker pending items: ${pending.length}`);

    return { pendingCount: pending.length };
  } catch (err) {
    console.warn("Sync worker failed", err);
    return { pendingCount: 0 };
  }
}
