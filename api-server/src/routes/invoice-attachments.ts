import { Router, type IRouter } from "express";
import { and, desc, eq, isNull, or } from "drizzle-orm";
import { db, invoiceAttachmentsTable, invoicesTable } from "@workspace/db";
import { invoiceAuditLogsTableSqlite } from "../../../lib/db/src/schema/invoices-sqlite";

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

  const [invoice] = await db
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

  await db.insert(invoiceAuditLogsTableSqlite).values({
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

router.get("/invoice-attachments/:declarationBaseNumber", async (req, res) => {
  try {
    const declarationBaseNumber = String(req.params.declarationBaseNumber || "").trim();

    if (!declarationBaseNumber) {
      return res.status(400).json({ error: "declarationBaseNumber is required" });
    }

    const attachments = await db
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

    const [attachment] = await db
      .insert(invoiceAttachmentsTable)
      .values({
        invoiceId,
        declarationNumber: String(req.body.declarationNumber).trim(),
        declarationBaseNumber: String(req.body.declarationBaseNumber).trim(),
        fileName: String(req.body.fileName).trim(),
        storedName: String(req.body.storedName).trim(),
        relativePath: String(req.body.relativePath).trim(),
        mimeType: optionalTrimmedString(req.body.mimeType),
        fileSize,
        category: optionalTrimmedString(req.body.category) || "other",
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
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "Invalid attachment id" });
    }

    const [attachment] = await db
      .update(invoiceAttachmentsTable)
      .set({ deletedAt: new Date() })
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
