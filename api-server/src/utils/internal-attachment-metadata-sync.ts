import { sqlite } from "@workspace/db";

export type AttachmentSyncMetadata = {
  syncId: string;
  fileHash: string | null;
  updatedAt: number;
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
  createdAt: number;
  deletedAt: number | null;
};

export function readLocalAttachmentMetadata(): AttachmentSyncMetadata[] {
  if (!sqlite) {
    throw new Error("SQLite database is unavailable");
  }

  const rows = sqlite.prepare(`
    SELECT
      sync_id AS syncId,
      file_hash AS fileHash,
      updated_at AS updatedAt,
      invoice_id AS invoiceId,
      declaration_number AS declarationNumber,
      declaration_base_number AS declarationBaseNumber,
      file_name AS fileName,
      stored_name AS storedName,
      relative_path AS relativePath,
      mime_type AS mimeType,
      file_size AS fileSize,
      category,
      storage_provider AS storageProvider,
      created_by AS createdBy,
      created_at AS createdAt,
      deleted_at AS deletedAt
    FROM invoice_attachments
    WHERE sync_id IS NOT NULL
      AND TRIM(sync_id) <> ''
    ORDER BY id
  `).all() as AttachmentSyncMetadata[];

  for (const row of rows) {
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
