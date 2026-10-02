import { sqlite } from "@workspace/db";

export type AttachmentSyncMetadata = {
  syncId: string;
  fileHash: string | null;
  updatedAt: number | null;
  invoiceId: number | null;
  declarationNumber: string;
  declarationBaseNumber: string;
  fileName: string;
  storedName: string;
  relativePath: string;
  mimeType: string | null;
  fileSize: number | null;
  category: string;
  storageProvider: string;
  createdBy: number | null;
  createdBySyncId: string | null;
  createdAt: number;
  deletedAt: number | null;
};

export function readLocalAttachmentMetadata(): AttachmentSyncMetadata[] {
  if (!sqlite) {
    throw new Error("SQLite database is unavailable");
  }

  const rows = sqlite.prepare(`
    SELECT
      a.sync_id AS syncId,
      a.file_hash AS fileHash,
      a.updated_at AS updatedAt,
      a.invoice_id AS invoiceId,
      a.declaration_number AS declarationNumber,
      a.declaration_base_number AS declarationBaseNumber,
      a.file_name AS fileName,
      a.stored_name AS storedName,
      a.relative_path AS relativePath,
      a.mime_type AS mimeType,
      a.file_size AS fileSize,
      a.category,
      a.storage_provider AS storageProvider,
      a.created_by AS createdBy,
      u.user_sync_id AS createdBySyncId,
      a.created_at AS createdAt,
      a.deleted_at AS deletedAt
    FROM invoice_attachments a
    LEFT JOIN users u ON u.id = a.created_by
    ORDER BY a.id
  `).all() as AttachmentSyncMetadata[];

  for (const row of rows) {
    if (!row.syncId || !row.syncId.trim()) {
      throw new Error("Attachment metadata contains a missing sync ID");
    }

    if (
      row.deletedAt === null &&
      (
        !row.fileHash ||
        !/^[a-fA-F0-9]{64}$/.test(row.fileHash) ||
        row.fileSize === null ||
        !Number.isSafeInteger(row.fileSize) ||
        row.fileSize < 0 ||
        !row.declarationBaseNumber ||
        row.declarationBaseNumber.trim().length !== 14
      )
    ) {
      throw new Error(`Active attachment metadata is incomplete: ${row.syncId}`);
    }

    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(row.syncId)
    ) {
      throw new Error(`Invalid attachment sync ID: ${row.syncId}`);
    }

    if (
      row.fileHash !== null &&
      !/^[a-fA-F0-9]{64}$/.test(row.fileHash)
    ) {
      throw new Error(`Invalid attachment hash: ${row.syncId}`);
    }

    if (
      row.fileSize !== null &&
      (!Number.isSafeInteger(row.fileSize) || row.fileSize < 0)
    ) {
      throw new Error(`Invalid attachment size: ${row.syncId}`);
    }
  }

  return rows;
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

export async function pushAttachmentMetadataToInternalServer(
  connectionString: string,
): Promise<{ processed: number }> {
  const { createRequire } = await import("module");
  const require = createRequire(process.cwd() + "/package.json");

  const { Client } = require("pg") as {
    Client: new (options: {
      connectionString: string;
      connectionTimeoutMillis: number;
    }) => {
      connect(): Promise<void>;
      query(sql: string, values?: unknown[]): Promise<unknown>;
      end(): Promise<void>;
    };
  };

  const rows = readLocalAttachmentMetadata();

  if (rows.length === 0) return { processed: 0 };

  const client = new Client({
    connectionString,
    connectionTimeoutMillis: 5000,
  });

  await client.connect();

  let transaction = false;

  try {
    await client.query("BEGIN");
    transaction = true;

    let processed = 0;

    for (const row of rows) {
      if (row.createdBy !== null && !row.createdBySyncId) {
        throw new Error(`Attachment creator UUID is missing: ${row.syncId}`);
      }

      let serverCreatedBy: number | null = null;

      if (row.createdBySyncId) {
        const creator = await client.query(
          `SELECT id FROM public.users WHERE user_sync_id = $1`,
          [row.createdBySyncId],
        ) as { rows: Array<{ id: number }> };

        if (creator.rows.length !== 1) {
          throw new Error(`Attachment creator not found on internal server: ${row.syncId}`);
        }

        serverCreatedBy = creator.rows[0].id;
      }

      await client.query(
        `
        INSERT INTO invoice_attachments (
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

      processed++;
    }

    await client.query("COMMIT");
    transaction = false;

    return { processed };
  } catch (error) {
    if (transaction) {
      await client.query("ROLLBACK").catch(() => undefined);
    }
    throw error;
  } finally {
    await client.end();
  }
}


function attachmentVersionTime(
  row: Pick<AttachmentSyncMetadata, "updatedAt" | "deletedAt" | "createdAt">,
): number {
  return Math.max(
    row.updatedAt ?? 0,
    row.deletedAt ?? 0,
    row.createdAt ?? 0,
  );
}

function shouldApplyIncomingAttachment(
  incoming: AttachmentSyncMetadata,
  local: Pick<
    AttachmentSyncMetadata,
    "updatedAt" | "deletedAt" | "createdAt"
  >,
): boolean {
  // Never reactivate an attachment deleted on this device.
  if (local.deletedAt !== null && incoming.deletedAt === null) {
    return false;
  }

  // Apply only strictly newer metadata.
  return attachmentVersionTime(incoming) > attachmentVersionTime(local);
}


function resolveLocalAttachmentCreator(
  row: AttachmentSyncMetadata,
): number | null {
  if (!sqlite) {
    throw new Error("SQLite database is unavailable");
  }

  if (row.createdBy === null) {
    return null;
  }

  if (!row.createdBySyncId) {
    throw new Error(`Attachment creator UUID is missing: ${row.syncId}`);
  }

  const matches = sqlite.prepare(`
    SELECT id
    FROM users
    WHERE user_sync_id = ? COLLATE NOCASE
  `).all(row.createdBySyncId) as Array<{ id: number }>;

  if (matches.length !== 1) {
    throw new Error(
      `Attachment creator cannot be resolved locally: ${row.syncId}`,
    );
  }

  return matches[0].id;
}

export async function readInternalAttachmentMetadata(
  connectionString: string,
): Promise<Array<AttachmentSyncMetadata>> {
  const { createRequire } = await import("module");
  const require = createRequire(process.cwd() + "/package.json");
  const { Client } = require("pg");

  const client = new Client({
    connectionString,
    connectionTimeoutMillis: 5000,
  });

  await client.connect();

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

    const seenSyncIds = new Set<string>();

    for (const row of result.rows as AttachmentSyncMetadata[]) {
      if (
        typeof row.syncId !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(row.syncId)
      ) {
        throw new Error("Invalid attachment sync ID received from internal server");
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

    return result.rows.map((row: AttachmentSyncMetadata) => ({
      ...row,
      updatedAt: toSafeAttachmentInteger(row.updatedAt, "updated_at", true),
      fileSize: toSafeAttachmentInteger(row.fileSize, "file_size", true),
      createdAt: toSafeAttachmentInteger(row.createdAt, "created_at")!,
      deletedAt: toSafeAttachmentInteger(row.deletedAt, "deleted_at", true),
    }));
  } finally {
    await client.end();
  }
}

export function applyInternalAttachmentMetadata(
  rows: AttachmentSyncMetadata[],
): { inserted: number; updated: number; skipped: number } {
  if (!sqlite) {
    throw new Error("SQLite database is unavailable");
  }

  return sqlite.transaction(() => {
    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    // Reject duplicate identities before modifying any local metadata.
    const incomingIds = new Set<string>();

    for (const row of rows) {
      if (
        typeof row.syncId !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(row.syncId)
      ) {
        throw new Error("Invalid incoming attachment sync ID");
      }

      const key = row.syncId.toLowerCase();

      if (incomingIds.has(key)) {
        throw new Error(
          `Duplicate incoming attachment sync ID: ${row.syncId}`,
        );
      }

      incomingIds.add(key);
    }

    // Match attachments by their global identity, never by local row ID.
    const findLocal = sqlite!.prepare(`
      SELECT
        id,
        updated_at AS updatedAt,
        deleted_at AS deletedAt,
        created_at AS createdAt
      FROM invoice_attachments
      WHERE sync_id = ? COLLATE NOCASE
    `);

    for (const row of rows) {
      const existing = findLocal.get(row.syncId) as
        | {
            id: number;
            updatedAt: number | null;
            deletedAt: number | null;
            createdAt: number;
          }
        | undefined;

      if (!existing) {
        const localCreatorId = resolveLocalAttachmentCreator(row);

        sqlite!.prepare(`
          INSERT INTO invoice_attachments (
            sync_id, file_hash, updated_at,
            invoice_id, declaration_number, declaration_base_number,
            file_name, stored_name, relative_path, mime_type,
            file_size, category, storage_provider,
            created_by, created_at, deleted_at
          ) VALUES (
            ?, ?, ?,
            NULL, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?,
            ?, ?, ?
          )
        `).run(
          row.syncId,
          row.fileHash,
          row.updatedAt,
          row.declarationNumber,
          row.declarationBaseNumber,
          row.fileName,
          row.storedName,
          row.relativePath,
          row.mimeType,
          row.fileSize,
          row.category,
          row.storageProvider,
          localCreatorId,
          row.createdAt,
          row.deletedAt,
        );

        inserted++;
        continue;
      }

      if (!shouldApplyIncomingAttachment(row, existing)) {
        skipped++;
        continue;
      }

      const localCreatorId = resolveLocalAttachmentCreator(row);

      sqlite!.prepare(`
        UPDATE invoice_attachments
        SET
          file_hash = ?,
          updated_at = ?,
          declaration_number = ?,
          declaration_base_number = ?,
          file_name = ?,
          stored_name = ?,
          relative_path = ?,
          mime_type = ?,
          file_size = ?,
          category = ?,
          storage_provider = ?,
          created_by = ?,
          created_at = ?,
          deleted_at = ?
        WHERE id = ?
      `).run(
        row.fileHash,
        row.updatedAt,
        row.declarationNumber,
        row.declarationBaseNumber,
        row.fileName,
        row.storedName,
        row.relativePath,
        row.mimeType,
        row.fileSize,
        row.category,
        row.storageProvider,
        localCreatorId,
        row.createdAt,
        row.deletedAt,
        existing.id,
      );

      updated++;
    }

    return { inserted, updated, skipped };
  }).immediate();
}

export async function pullAttachmentMetadataFromInternalServer(
  connectionString: string,
): Promise<{ inserted: number; updated: number; skipped: number }> {
  // Fetch and validate the complete server metadata before local writes.
  const rows = await readInternalAttachmentMetadata(connectionString);

  // Apply all rows inside one synchronous SQLite transaction.
  return applyInternalAttachmentMetadata(rows);
}
