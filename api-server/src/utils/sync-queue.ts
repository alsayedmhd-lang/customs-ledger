import { db, syncQueueTable } from "@workspace/db";

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

export async function enqueueSyncChange({
  entityType,
  entityId,
  action,
  payload,
  userId,
}: EnqueueSyncChangeInput): Promise<void> {
  try {
    await db.insert(syncQueueTable).values({
      entityType,
      entityId: String(entityId),
      operation: action,
      payloadJson: JSON.stringify({
        ...(payload && typeof payload === "object" ? payload : { value: payload ?? null }),
        userId: userId ?? null,
      }),
      status: "pending",
      retryCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  } catch (err) {
    console.warn("Failed to enqueue sync change", {
      entityType,
      entityId,
      action,
      err,
    });
  }
}
