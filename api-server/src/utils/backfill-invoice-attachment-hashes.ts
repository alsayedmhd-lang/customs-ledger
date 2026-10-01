import { createHash } from "node:crypto";
import { createReadStream, promises as fs } from "node:fs";
import path from "node:path";
import { sqlite } from "@workspace/db";

type AttachmentRow = {
  id: number;
  declaration_base_number: string;
  stored_name: string;
  relative_path: string;
  file_size: number | null;
};

export async function backfillInvoiceAttachmentHashes(dataRoot: string) {
  if (!sqlite) {
    return { checked: 0, updated: 0, skipped: 0 };
  }

  const root = path.resolve(dataRoot);
  const attachmentsRoot = path.resolve(root, "attachments");

  const sqlitePath = process.env.SQLITE_DB_PATH?.trim();

  if (
    process.env.DB_PROVIDER !== "sqlite" ||
    !sqlitePath ||
    !dataRoot.trim()
  ) {
    console.warn(
      "[ATTACHMENT_HASH_BACKFILL] Skipped: incomplete SQLite storage configuration"
    );
    return { checked: 0, updated: 0, skipped: 0 };
  }

  const expectedDatabaseDir = path.resolve(root, "database");
  const actualDatabaseDir = path.dirname(path.resolve(sqlitePath));

  if (
    process.platform === "win32"
      ? expectedDatabaseDir.toLowerCase() !== actualDatabaseDir.toLowerCase()
      : expectedDatabaseDir !== actualDatabaseDir
  ) {
    console.warn(
      "[ATTACHMENT_HASH_BACKFILL] Skipped: SQLite database and attachment storage roots do not match"
    );
    return { checked: 0, updated: 0, skipped: 0 };
  }

  const rows = sqlite.prepare(`
    SELECT id, declaration_base_number, stored_name,
           relative_path, file_size
    FROM invoice_attachments
    WHERE deleted_at IS NULL
      AND (file_hash IS NULL OR TRIM(file_hash) = '')
    ORDER BY id
  `).all() as AttachmentRow[];

  const update = sqlite.prepare(`
    UPDATE invoice_attachments
    SET file_hash = ?
    WHERE id = ?
      AND deleted_at IS NULL
      AND (file_hash IS NULL OR TRIM(file_hash) = '')
  `);

  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    try {
      const normalized = row.relative_path.replace(/\\/g, "/");
      const parts = normalized.split("/");

      if (
        parts.length !== 4 ||
        parts[0] !== "attachments" ||
        parts[1] !== "declarations" ||
        parts[2] !== row.declaration_base_number ||
        parts[3] !== row.stored_name ||
        parts.some((part) => !part || part === "." || part === "..") ||
        parts.some((part) => part.includes(":"))
      ) {
        throw new Error("Invalid attachment relative path");
      }

      const fullPath = path.resolve(root, ...parts);
      const relativeToRoot = path.relative(attachmentsRoot, fullPath);

      if (
        !relativeToRoot ||
        relativeToRoot === ".." ||
        relativeToRoot.startsWith(`..${path.sep}`) ||
        path.isAbsolute(relativeToRoot)
      ) {
        throw new Error("Attachment path outside storage root");
      }

      const realAttachmentsRoot = await fs.realpath(attachmentsRoot);
      const realFilePath = await fs.realpath(fullPath);
      const realRelative = path.relative(realAttachmentsRoot, realFilePath);

      if (
        !realRelative ||
        realRelative === ".." ||
        realRelative.startsWith(`..${path.sep}`) ||
        path.isAbsolute(realRelative)
      ) {
        throw new Error("Attachment resolves outside storage root");
      }

      const stat = await fs.stat(realFilePath);

      if (!stat.isFile()) {
        throw new Error("Attachment is not a regular file");
      }

      if (row.file_size !== null && stat.size !== row.file_size) {
        throw new Error("Attachment size mismatch");
      }

      const hash = createHash("sha256");

      await new Promise<void>((resolve, reject) => {
        const stream = createReadStream(realFilePath);

        stream.on("data", (chunk) => hash.update(chunk));
        stream.on("error", reject);
        stream.on("end", resolve);
      });

      const fileHash = hash.digest("hex");
      const result = update.run(fileHash, row.id);

      if (result.changes === 1) {
        updated++;
      } else {
        skipped++;
      }
    } catch (error) {
      skipped++;
      console.warn(
        `[ATTACHMENT_HASH_BACKFILL] Skipped attachment ${row.id}:`,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  console.log(
    `[ATTACHMENT_HASH_BACKFILL] Checked=${rows.length}, Updated=${updated}, Skipped=${skipped}`
  );

  return { checked: rows.length, updated, skipped };
}


