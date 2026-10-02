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
