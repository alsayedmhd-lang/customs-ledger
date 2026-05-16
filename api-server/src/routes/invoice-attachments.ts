import { Router, type IRouter } from "express";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db, invoiceAttachmentsTable } from "@workspace/db";

const router: IRouter = Router();

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
