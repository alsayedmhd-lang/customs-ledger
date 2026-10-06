import { randomUUID } from "node:crypto";
import { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3";
import { Router, type IRouter } from "express";
import { and, desc, eq, isNull, or } from "drizzle-orm";
import { db, invoiceAttachmentsTable, invoicesTable, usersTable } from "@workspace/db";
import { openVerifiedAttachment, receiveVerifiedAttachment } from "../utils/attachment-storage";
import { invoiceAuditLogsTableSqlite } from "../../../lib/db/src/schema/invoices-sqlite";

type LedgerSqliteDb = ReturnType<typeof drizzleSqlite>;

const router: IRouter = Router();

async function resolveAttachmentInvoiceId(input: {
  invoiceId: number | null;
  declarationNumber?: unknown;
  declarationBaseNumber?: unknown;
}) {
  if (input.invoiceId && Number.isInteger(input.invoiceId) && input.invoiceId > 0) {
    return input.invoiceId;
  }

  const declarationNumber = String(input.declarationNumber ?? "").trim();
  const declarationBaseNumber = String(input.declarationBaseNumber ?? "").trim();
  if (!declarationNumber && !declarationBaseNumber) return null;

  const filters = [isNull(invoicesTable.deletedAt)];
  const shipmentFilters = [];
  if (declarationNumber) shipmentFilters.push(eq(invoicesTable.shipmentRef, declarationNumber));
  if (declarationBaseNumber) shipmentFilters.push(eq(invoicesTable.shipmentRef, declarationBaseNumber));

  const [invoice] = await (db as LedgerSqliteDb)
    .select({ id: invoicesTable.id })
    .from(invoicesTable)
    .where(and(...filters, shipmentFilters.length === 1 ? shipmentFilters[0] : or(...shipmentFilters)))
    .limit(1);

  return invoice?.id ?? null;
}

async function createAttachmentAuditLog(input: {
  req: any;
  invoiceId: number | null;
  attachmentAction: "added" | "deleted";
  fileName: string;
  category?: string | null;
}) {
  if (!input.invoiceId) return;

  await (db as LedgerSqliteDb).insert(invoiceAuditLogsTableSqlite).values({
    invoiceId: input.invoiceId,
    action: "attachments_updated",
    userId: input.req.user?.userId ?? null,
    username: input.req.user?.username ?? null,
    userEmail: input.req.user?.email ?? null,
    userPhone: input.req.user?.phone ?? null,
    changesJson: JSON.stringify({
      messageAr: "\u062a\u0645 \u062a\u0639\u062f\u064a\u0644 \u0627\u0644\u0645\u0631\u0641\u0642\u0627\u062a",
      messageEn: "Attachments updated",
      attachmentAction: input.attachmentAction,
      fileName: input.fileName,
      category: input.category ?? null,
    }),
    createdAt: new Date(),
  });
}

router.post("/invoice-attachments/file/:syncId", async (req, res) => {
  try {
    if (req.user?.role !== "admin") {
      return res.status(403).json({
        error: "Attachment receiving requires administrator permission",
      });
    }

    const syncId = String(req.params.syncId ?? "").trim();

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(syncId)) {
      return res.status(400).json({ error: "Invalid attachment syncId" });
    }

    const attachmentDb = db as LedgerSqliteDb;

    const [attachment] = await attachmentDb
      .select()
      .from(invoiceAttachmentsTable)
      .where(
        and(
          eq(invoiceAttachmentsTable.syncId, syncId),
          isNull(invoiceAttachmentsTable.deletedAt)
        )
      )
      .limit(1);

    if (!attachment) {
      return res.status(404).json({ error: "Attachment metadata not found" });
    }

    if (
      !attachment.fileHash ||
      !/^[a-fA-F0-9]{64}$/.test(attachment.fileHash) ||
      attachment.fileSize === null ||
      !Number.isSafeInteger(attachment.fileSize) ||
      attachment.fileSize < 0
    ) {
      return res.status(409).json({
        error: "Attachment integrity metadata is incomplete",
      });
    }

    const contentType = String(req.headers["content-type"] ?? "").toLowerCase();

    if (
      !contentType.startsWith("application/octet-stream") &&
      !contentType.startsWith("application/x-binary")
    ) {
      return res.status(415).json({
        error: "Attachment upload requires binary content",
      });
    }

    const savedPath = await receiveVerifiedAttachment(
      {
        declarationBaseNumber: attachment.declarationBaseNumber,
        storedName: attachment.storedName,
        fileHash: attachment.fileHash,
        fileSize: attachment.fileSize,
      },
      req
    );

    return res.json({
      ok: true,
      syncId: attachment.syncId,
      fileHash: attachment.fileHash,
      fileSize: attachment.fileSize,
      storedName: attachment.storedName,
      declarationBaseNumber: attachment.declarationBaseNumber,
      savedPath,
    });
  } catch (error) {
    console.error("Attachment receive failed:", error);

    if (error instanceof Error) {
      const message = error.message;

      if (
        message === "Received attachment size mismatch" ||
        message === "Received attachment SHA-256 mismatch" ||
        message === "Attachment exceeds expected size"
      ) {
        return res.status(422).json({ error: message });
      }

      if (
        message === "Invalid declaration base number" ||
        message === "Invalid stored attachment name" ||
        message === "Invalid SHA-256 hash" ||
        message === "Invalid attachment size"
      ) {
        return res.status(400).json({ error: message });
      }
    }

    return res.status(500).json({ error: "Attachment receive failed" });
  }
});
router.get("/invoice-attachments/file/:syncId", async (req, res) => {
  const attachmentDb = db as LedgerSqliteDb;
  let handle: Awaited<ReturnType<typeof openVerifiedAttachment>> = null;

  try {
    const syncId = String(req.params.syncId ?? "").trim();

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(syncId)) {
      return res.status(400).json({ error: "Invalid attachment syncId" });
    }

    const [attachment] = await attachmentDb
      .select()
      .from(invoiceAttachmentsTable)
      .where(
        and(
          eq(invoiceAttachmentsTable.syncId, syncId),
          isNull(invoiceAttachmentsTable.deletedAt)
        )
      )
      .limit(1);

    if (!attachment || !attachment.invoiceId) {
      return res.status(404).json({ error: "Attachment not found" });
    }

    const [invoice] = await attachmentDb
      .select({
        id: invoicesTable.id,
        clientId: invoicesTable.clientId,
      })
      .from(invoicesTable)
      .where(
        and(
          eq(invoicesTable.id, attachment.invoiceId),
          isNull(invoicesTable.deletedAt)
        )
      )
      .limit(1);

    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    if (req.user?.role === "client") {
      const [user] = await attachmentDb
        .select({
          clientId: usersTable.clientId,
          clientViewPermissions: usersTable.clientViewPermissions,
        })
        .from(usersTable)
        .where(eq(usersTable.id, req.user.userId))
        .limit(1);

      const permissions = user?.clientViewPermissions as
        | { canViewInvoices?: boolean }
        | null
        | undefined;

      if (
        !user?.clientId ||
        Number(user.clientId) !== invoice.clientId ||
        permissions?.canViewInvoices === false
      ) {
        return res.status(403).json({
          error: "Invoice is not allowed for this client user",
        });
      }
    }

    if (
      !attachment.fileHash ||
      !/^[a-fA-F0-9]{64}$/.test(attachment.fileHash) ||
      attachment.fileSize === null ||
      !Number.isSafeInteger(attachment.fileSize) ||
      attachment.fileSize < 0
    ) {
      return res.status(409).json({
        error: "Attachment integrity metadata is incomplete",
      });
    }

    handle = await openVerifiedAttachment({
      declarationBaseNumber: attachment.declarationBaseNumber,
      storedName: attachment.storedName,
      fileHash: attachment.fileHash,
      fileSize: attachment.fileSize,
    });

    if (!handle) {
      return res.status(404).json({
        error: "Verified attachment file is not available locally",
      });
    }

    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Length", String(attachment.fileSize));
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="ledger-attachment-${syncId}"`
    );

    const stream = handle.createReadStream({
      autoClose: false,
      start: 0,
    });

    res.on("close", () => {
      if (!res.writableFinished) {
        stream.destroy();
      }
    });

    stream.on("error", (error) => {
      console.error("Attachment download stream failed:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Attachment download failed" });
      } else {
        res.destroy(error);
      }
    });

    const closeAttachmentHandle = () => {
      const currentHandle = handle;
      handle = null;

      if (currentHandle) {
        void currentHandle.close().catch((error) => {
          console.error("Attachment file close failed:", error);
        });
      }
    };

    stream.once("end", closeAttachmentHandle);
    stream.once("close", closeAttachmentHandle);

    stream.pipe(res);
    return;
  } catch (error) {
    console.error("Attachment download failed:", error);

    if (handle) {
      await handle.close().catch(() => undefined);
    }

    if (!res.headersSent) {
      return res.status(500).json({ error: "Internal server error" });
    }

    return res.destroy();
  }
});
router.get("/invoice-attachments/:declarationBaseNumber", async (req, res) => {
  try {
    const declarationBaseNumber = String(req.params.declarationBaseNumber || "").trim();

    if (!declarationBaseNumber) {
      return res.status(400).json({ error: "declarationBaseNumber is required" });
    }

    const attachments = await (db as LedgerSqliteDb)
      .select()
      .from(invoiceAttachmentsTable)
      .where(
        and(
          eq(invoiceAttachmentsTable.declarationBaseNumber, declarationBaseNumber),
          isNull(invoiceAttachmentsTable.deletedAt)
        )
      )
      .orderBy(desc(invoiceAttachmentsTable.createdAt));

    return res.json(attachments.map(formatAttachment));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/invoice-attachments", async (req, res) => {
  try {
    if (req.user?.role === "client") {
      return res.status(403).json({
        error: "Client users have read-only access to attachments",
      });
    }

    const suppliedHash = optionalTrimmedString(req.body.fileHash);
    if (suppliedHash && !/^[a-fA-F0-9]{64}$/.test(suppliedHash)) {
      return res.status(400).json({ error: "Invalid SHA-256 fileHash" });
    }
    const validationError = validateCreateBody(req.body);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const invoiceId = normalizeOptionalNumber(req.body.invoiceId);
    if (invoiceId === undefined) {
      return res.status(400).json({ error: "invoiceId must be a number or null" });
    }

    const fileSize = normalizeOptionalNumber(req.body.fileSize);
    if (fileSize === undefined) {
      return res.status(400).json({ error: "fileSize must be a number or null" });
    }

    // Return the existing active record; do not create another sync identity or audit event.
    if (suppliedHash) {
      const existing = (db as LedgerSqliteDb).select().from(invoiceAttachmentsTable)
        .where(and(
          eq(invoiceAttachmentsTable.declarationBaseNumber, String(req.body.declarationBaseNumber).trim()),
          eq(invoiceAttachmentsTable.fileHash, suppliedHash.toLowerCase()),
          isNull(invoiceAttachmentsTable.deletedAt)
        )).get();
      if (existing) return res.status(200).json(formatAttachment(existing));
    }
    const [attachment] = await (db as LedgerSqliteDb)
      .insert(invoiceAttachmentsTable)
      .values({
        syncId: randomUUID(),
        updatedAt: new Date(),
        invoiceId,
        declarationNumber: String(req.body.declarationNumber).trim(),
        declarationBaseNumber: String(req.body.declarationBaseNumber).trim(),
        fileName: String(req.body.fileName).trim(),
        storedName: String(req.body.storedName).trim(),
        relativePath: String(req.body.relativePath).trim(),
        mimeType: optionalTrimmedString(req.body.mimeType),
        fileSize,
        category: optionalTrimmedString(req.body.category) || "other",
        fileHash: optionalTrimmedString(req.body.fileHash)?.toLowerCase() ?? null,
        storageProvider: "local",
        createdBy: req.user?.userId ?? null,
        createdAt: new Date(),
      })
      .returning();

    const auditInvoiceId = await resolveAttachmentInvoiceId({
      invoiceId,
      declarationNumber: attachment.declarationNumber,
      declarationBaseNumber: attachment.declarationBaseNumber,
    });

    await createAttachmentAuditLog({
      req,
      invoiceId: auditInvoiceId,
      attachmentAction: "added",
      fileName: attachment.fileName,
      category: attachment.category,
    });

    return res.status(201).json(formatAttachment(attachment));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/invoice-attachments/:id", async (req, res) => {
  try {
    if (req.user?.role === "client") {
      return res.status(403).json({
        error: "Client users have read-only access to attachments",
      });
    }

    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "Invalid attachment id" });
    }

    const [attachment] = await (db as LedgerSqliteDb)
      .update(invoiceAttachmentsTable)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(invoiceAttachmentsTable.id, id), isNull(invoiceAttachmentsTable.deletedAt)))
      .returning();

    if (!attachment) {
      return res.status(404).json({ error: "Attachment not found" });
    }

    const auditInvoiceId = await resolveAttachmentInvoiceId({
      invoiceId: attachment.invoiceId,
      declarationNumber: attachment.declarationNumber,
      declarationBaseNumber: attachment.declarationBaseNumber,
    });

    await createAttachmentAuditLog({
      req,
      invoiceId: auditInvoiceId,
      attachmentAction: "deleted",
      fileName: attachment.fileName,
      category: attachment.category,
    });

    return res.status(204).send();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

function validateCreateBody(body: any) {
  const requiredFields = ["declarationNumber", "declarationBaseNumber", "fileName", "storedName", "relativePath"];

  for (const field of requiredFields) {
    if (!String(body?.[field] ?? "").trim()) {
      return `${field} is required`;
    }
  }

  return null;
}

function normalizeOptionalNumber(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function optionalTrimmedString(value: unknown) {
  if (value === undefined || value === null) return null;
  const stringValue = String(value).trim();
  return stringValue || null;
}

function formatAttachment(attachment: typeof invoiceAttachmentsTable.$inferSelect) {
  return {
    id: attachment.id,
    syncId: attachment.syncId,
    fileHash: attachment.fileHash,
    fileName: attachment.fileName,
    mimeType: attachment.mimeType,
    fileSize: attachment.fileSize,
    category: attachment.category,
    storageProvider: attachment.storageProvider,
    createdAt: attachment.createdAt ? new Date(attachment.createdAt).toISOString() : null,
    declarationNumber: attachment.declarationNumber,
    declarationBaseNumber: attachment.declarationBaseNumber,
    storedName: attachment.storedName,
    relativePath: attachment.relativePath,
  };
}

export default router;
