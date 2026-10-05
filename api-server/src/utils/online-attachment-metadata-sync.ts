import { sqlite } from "@workspace/db";
import { ensureInvoiceAttachmentsTable } from "./ensure-invoice-attachments-table";
import {
  readLocalAttachmentMetadata, applyInternalAttachmentMetadata,
  type AttachmentSyncMetadata,
} from "./internal-attachment-metadata-sync";

// Metadata only. Files are fetched separately through the trusted-device channel.
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Creator = { id: number; username: string; user_sync_id: string | null };

function localCreator(row: AttachmentSyncMetadata): Creator {
  const matches = sqlite!.prepare(
    "SELECT id, username, user_sync_id FROM users WHERE user_sync_id = ? COLLATE NOCASE"
  ).all(row.createdBySyncId) as Creator[];
  if (matches.length !== 1 || !uuid.test(String(matches[0].user_sync_id || ""))) {
    throw new Error(`Local attachment creator UUID cannot be resolved: ${row.syncId}`);
  }
  return matches[0];
}

async function resolvePushCreator(client: any, row: AttachmentSyncMetadata): Promise<number | null> {
  if (row.createdBy === null) return null;
  if (!row.createdBySyncId || !uuid.test(row.createdBySyncId)) throw new Error(`Attachment creator UUID is missing or invalid: ${row.syncId}`);
  const local = localCreator(row);
  if (Number(local.id) !== Number(row.createdBy)) {
    throw new Error(`Local attachment creator identity conflict: ${row.syncId}`);
  }
  const result = await client.query(
    "SELECT id, username, user_sync_id FROM public.users WHERE LOWER(TRIM(username)) = LOWER(TRIM($1)) LIMIT 2",
    [local.username]
  ) as { rows: Creator[] };
  if (result.rows.length !== 1) {
    throw new Error(`Online attachment creator is missing or ambiguous: ${local.username}`);
  }
  const online = result.rows[0];
  if (online.user_sync_id && online.user_sync_id.toLowerCase() !== row.createdBySyncId!.toLowerCase()) {
    throw new Error(`Online attachment creator UUID conflict: ${local.username}`);
  }
  const collision = await client.query(
    "SELECT id FROM public.users WHERE user_sync_id = $1 AND id <> $2 LIMIT 1",
    [row.createdBySyncId, online.id]
  );
  if (collision.rows.length) throw new Error(`Online creator UUID belongs to another account: ${local.username}`);
  if (!online.user_sync_id) {
    await client.query("UPDATE public.users SET user_sync_id = $1 WHERE id = $2 AND user_sync_id IS NULL", [row.createdBySyncId, online.id]);
  }
  return Number(online.id);
}

function resolvePullCreators(rows: AttachmentSyncMetadata[], onlineUsers: Creator[]) {
  sqlite!.transaction(() => {
    const seen = new Set<string>();
    for (const row of rows) {
      if (row.createdBy === null || seen.has(row.createdBySyncId!)) continue;
      seen.add(row.createdBySyncId!);
      const online = onlineUsers.filter(user => String(user.id) === String(row.createdBy));
      if (online.length !== 1 || online[0].user_sync_id?.toLowerCase() !== row.createdBySyncId) {
        throw new Error(`Online attachment creator identity is invalid: ${row.syncId}`);
      }
      const matches = sqlite!.prepare(
        "SELECT id, username, user_sync_id FROM users WHERE LOWER(TRIM(username)) = LOWER(TRIM(?)) LIMIT 2"
      ).all(online[0].username) as Creator[];
      if (matches.length !== 1) throw new Error(`Local attachment creator is missing or ambiguous: ${online[0].username}`);
      const local = matches[0];
      if (local.user_sync_id && local.user_sync_id.toLowerCase() !== row.createdBySyncId) {
        throw new Error(`Local attachment creator UUID conflict: ${local.username}`);
      }
      const collisions = sqlite!.prepare(
        "SELECT id FROM users WHERE user_sync_id = ? COLLATE NOCASE AND id <> ?"
      ).all(row.createdBySyncId, local.id) as Array<{ id: number }>;
      if (collisions.length) throw new Error(`Local creator UUID belongs to another account: ${local.username}`);
      if (!local.user_sync_id) sqlite!.prepare(
        "UPDATE users SET user_sync_id = ? WHERE id = ? AND user_sync_id IS NULL"
      ).run(row.createdBySyncId, local.id);
    }
  }).immediate();
}

function toSafeAttachmentInteger(
  value: unknown,
  field: string,
  nullable = false,
): number | null {
  if (value === null || value === undefined) {
    if (nullable) return null;
    throw new Error(`Missing attachment numeric field: ${field}`);
  }

  if (
    typeof value !== "number" &&
    !(typeof value === "string" && /^-?\d+$/.test(value))
  ) {
    throw new Error(`Invalid attachment numeric field: ${field}`);
  }

  const number = Number(value);

  if (!Number.isSafeInteger(number) || number < 0) {
    throw new Error(`Unsafe attachment numeric field: ${field}`);
  }

  return number;
}


function normalizeMetadata(rows: AttachmentSyncMetadata[]): AttachmentSyncMetadata[] {
  const seenSyncIds = new Set<string>();

  for (const row of rows) {
    if (
      typeof row.syncId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(row.syncId)
    ) {
      throw new Error("Invalid attachment sync ID received from Online");
    }

    const key = row.syncId.toLowerCase();

    if (seenSyncIds.has(key)) {
      throw new Error(`Duplicate attachment sync ID received: ${row.syncId}`);
    }

    seenSyncIds.add(key);

    if (
      typeof row.declarationBaseNumber !== "string" ||
      !/^[a-zA-Z0-9]{14}$/.test(row.declarationBaseNumber) ||
      typeof row.declarationNumber !== "string" ||
      !row.declarationNumber.trim() ||
      typeof row.fileName !== "string" ||
      !row.fileName.trim() ||
      typeof row.storedName !== "string" ||
      !row.storedName.trim() ||
      typeof row.relativePath !== "string" ||
      !row.relativePath.trim()
    ) {
      throw new Error(`Invalid attachment metadata received: ${row.syncId}`);
    }

    if (
      row.createdBy !== null &&
      (typeof row.createdBySyncId !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          row.createdBySyncId,
        ))
    ) {
      throw new Error(
        `Attachment creator UUID is missing or invalid: ${row.syncId}`,
      );
    }

    const normalizedPath = row.relativePath.replace(/\\/g, "/");
    const expectedPath =
      `attachments/declarations/${row.declarationBaseNumber}/${row.storedName}`;

    if (
      row.storedName === "." ||
      row.storedName.includes("..") ||
      /[\x00-\x1f]/.test(row.storedName) ||
      row.storedName.includes("/") ||
      row.storedName.includes("\\") ||
      row.storedName.includes(":") ||
      normalizedPath !== expectedPath ||
      normalizedPath.split("/").some((part: string) => part === "..")
    ) {
      throw new Error(`Unsafe attachment path received: ${row.syncId}`);
    }

    if (
      row.fileHash !== null &&
      (typeof row.fileHash !== "string" ||
        !/^[a-fA-F0-9]{64}$/.test(row.fileHash))
    ) {
      throw new Error(`Invalid attachment SHA256 received: ${row.syncId}`);
    }

    if (row.deletedAt === null && row.fileHash === null) {
      throw new Error(`Active attachment SHA256 is missing: ${row.syncId}`);
    }

    if (row.deletedAt === null && row.fileSize === null) {
      throw new Error(`Active attachment size is missing: ${row.syncId}`);
    }
  }

  return rows.map((row: AttachmentSyncMetadata) => ({
    ...row,
    syncId: row.syncId.toLowerCase(),
    createdBySyncId: row.createdBySyncId?.toLowerCase() ?? null,
    updatedAt: toSafeAttachmentInteger(row.updatedAt, "updated_at", true),
    fileSize: toSafeAttachmentInteger(row.fileSize, "file_size", true),
    createdAt: toSafeAttachmentInteger(row.createdAt, "created_at")!,
    deletedAt: toSafeAttachmentInteger(row.deletedAt, "deleted_at", true),
  }));
}


export async function pushOnlineAttachmentMetadata(client: any) {
  ensureInvoiceAttachmentsTable();
  const rows = normalizeMetadata(readLocalAttachmentMetadata());
  let processed = 0;
  const creators = new Map<string, number | null>();
  await client.query("BEGIN");
  try {
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SELECT pg_advisory_xact_lock(68291303)");
    for (const row of rows) {
      const key = row.createdBySyncId ?? "";
      if (!creators.has(key)) creators.set(key, await resolvePushCreator(client, row));
      const serverCreatedBy = creators.get(key)!;
      const result = await client.query(
        `
        INSERT INTO public.invoice_attachments (
          sync_id, file_hash, updated_at, invoice_id,
          declaration_number, declaration_base_number,
          file_name, stored_name, relative_path, mime_type,
          file_size, category, storage_provider,
          created_by, created_at, deleted_at
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,
          $9,$10,$11,$12,$13,$14,$15,$16
        )
        ON CONFLICT (sync_id)
        WHERE sync_id IS NOT NULL AND BTRIM(sync_id) <> ''
        DO UPDATE SET
          file_hash = EXCLUDED.file_hash,
          updated_at = EXCLUDED.updated_at,
          declaration_number = EXCLUDED.declaration_number,
          declaration_base_number = EXCLUDED.declaration_base_number,
          file_name = EXCLUDED.file_name,
          stored_name = EXCLUDED.stored_name,
          relative_path = EXCLUDED.relative_path,
          mime_type = EXCLUDED.mime_type,
          file_size = EXCLUDED.file_size,
          category = EXCLUDED.category,
          storage_provider = EXCLUDED.storage_provider,
          created_by = EXCLUDED.created_by,
          created_at = EXCLUDED.created_at,
          deleted_at = EXCLUDED.deleted_at
        WHERE (
            invoice_attachments.deleted_at IS NULL
            OR EXCLUDED.deleted_at IS NOT NULL
          )
          AND GREATEST(
                COALESCE(EXCLUDED.updated_at, 0),
                COALESCE(EXCLUDED.deleted_at, 0),
                COALESCE(EXCLUDED.created_at, 0)
              )
            > GREATEST(
                COALESCE(invoice_attachments.updated_at, 0),
                COALESCE(invoice_attachments.deleted_at, 0),
                COALESCE(invoice_attachments.created_at, 0)
              )
        `,
        [
          row.syncId,
          row.fileHash,
          row.updatedAt,
          null, // Attachments belong to declaration_base_number
          row.declarationNumber,
          row.declarationBaseNumber,
          row.fileName,
          row.storedName,
          row.relativePath,
          row.mimeType,
          row.fileSize,
          row.category,
          row.storageProvider,
          serverCreatedBy,
          row.createdAt,
          row.deletedAt,
        ],
      );

      processed += Number(result.rowCount || 0);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
  const result = { total: rows.length, processed, skipped: rows.length - processed };
  console.log("[SYNC][PUSH][ATTACHMENTS][DONE]", result);
  return result;
}

export async function pullOnlineAttachmentMetadata(client: any) {
  ensureInvoiceAttachmentsTable();
  // One PostgreSQL snapshot keeps the creator map consistent with the metadata.
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  let rows: AttachmentSyncMetadata[];
  let users: Creator[];
  try {
    const result = await client.query(`
      SELECT
        a.sync_id AS "syncId",
        a.file_hash AS "fileHash",
        a.updated_at AS "updatedAt",
        a.invoice_id AS "invoiceId",
        a.declaration_number AS "declarationNumber",
        a.declaration_base_number AS "declarationBaseNumber",
        a.file_name AS "fileName",
        a.stored_name AS "storedName",
        a.relative_path AS "relativePath",
        a.mime_type AS "mimeType",
        a.file_size AS "fileSize",
        a.category,
        a.storage_provider AS "storageProvider",
        a.created_by AS "createdBy",
        u.user_sync_id AS "createdBySyncId",
        a.created_at AS "createdAt",
        a.deleted_at AS "deletedAt"
      FROM public.invoice_attachments a
      LEFT JOIN public.users u ON u.id = a.created_by
      ORDER BY a.id
    `);

    rows = normalizeMetadata(result.rows);
    users = (await client.query("SELECT id, username, user_sync_id FROM public.users")).rows;
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
  const result = sqlite!.transaction(() => {
    resolvePullCreators(rows, users);
    return applyInternalAttachmentMetadata(rows);
  }).immediate();
  const summary = { total: rows.length, ...result };
  console.log("[SYNC][PULL][ATTACHMENTS][DONE]", summary);
  return summary;
}
