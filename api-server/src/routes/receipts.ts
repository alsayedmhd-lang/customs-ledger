import { getLocalDb } from "../utils/local-db";
import { Router, type IRouter } from "express";
import { sqlite, receiptsTable, clientsTable, invoicesTable, customerLedgerTableSqlite, usersTable, syncQueueTable } from "@workspace/db";
import { eq, desc, isNull, and, ne } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { enqueueSyncChange } from "../utils/sync-queue";
import { refreshAndQueueInvoicePaymentStatus } from "../utils/invoice-payment-state";
import { changeDocumentDeletion } from "../utils/document-deletion-sync";

const router: IRouter = Router();

async function getClientScope(req: any) {
  if (req.user?.role !== "client") return null;
  const [user] = await getLocalDb()
    .select({ clientId: usersTable.clientId, clientViewPermissions: usersTable.clientViewPermissions })
    .from(usersTable)
    .where(eq(usersTable.id, req.user.userId))
    .limit(1);
  return user?.clientId ? { clientId: Number(user.clientId), permissions: user.clientViewPermissions as any } : { clientId: null, permissions: null };
}

function rejectClientWrite(req: any, res: any) {
  if (req.user?.role !== "client") return false;
  res.status(403).json({ error: "Client users have read-only access" });
  return true;
}

function removeUniqueActiveReceiptPerInvoice() {
  if (!sqlite) return;

  try {
    sqlite.exec("DROP INDEX IF EXISTS receipts_invoice_id_unique_active;");
  } catch (error) {
    console.error("Failed to remove receipts invoice unique index:", error);
  }
}

removeUniqueActiveReceiptPerInvoice();

try {
  sqlite?.exec(`ALTER TABLE receipts ADD COLUMN created_by INTEGER;`);
} catch {}

try {
  sqlite?.exec(`ALTER TABLE receipts ADD COLUMN status TEXT NOT NULL DEFAULT 'issued';`);
} catch {}

type ReceiptStatus = "draft" | "issued" | "cancelled";

function normalizeReceiptStatus(value: unknown, fallback: ReceiptStatus = "draft"): ReceiptStatus {
  return value === "cancelled" ? "cancelled" : value === "issued" ? "issued" : value === "draft" ? "draft" : fallback;
}

async function deleteReceiptLedgerEntry(receiptId: number) {
  await getLocalDb()
    .delete(customerLedgerTableSqlite)
    .where(eq(customerLedgerTableSqlite.receiptId, receiptId));
}

export async function syncIssuedReceiptLedgerEntry(receipt: typeof receiptsTable.$inferSelect) {
  await deleteReceiptLedgerEntry(receipt.id);

  if (receipt.deletedAt != null || receipt.status !== "issued" || receipt.clientId === null) return;

  await getLocalDb().insert(customerLedgerTableSqlite).values({
    clientId: receipt.clientId,
    invoiceId: receipt.invoiceId ?? null,
    receiptId: receipt.id,
    entryDate: receipt.receiptDate,
    entryType: "receipt",
    descriptionAr: `سند قبض رقم ${receipt.receiptNumber}`,
    descriptionEn: `Receipt ${receipt.receiptNumber}`,
    referenceType: "receipt",
    referenceNumber: receipt.receiptNumber,
    debit: 0,
    credit: Number(receipt.amount ?? 0),
    balanceImpact: -Number(receipt.amount ?? 0),
    createdBy: receipt.createdBy ?? null,
  });
}

async function findActiveReceiptByInvoiceId(invoiceId: number) {
  const rows = await getLocalDb()
    .select()
    .from(receiptsTable)
    .leftJoin(invoicesTable, eq(receiptsTable.invoiceId, invoicesTable.id))
    .leftJoin(clientsTable, eq(receiptsTable.clientId, clientsTable.id))
    .leftJoin(usersTable, eq(usersTable.id, receiptsTable.createdBy))
    .where(
      and(
        eq(receiptsTable.invoiceId, invoiceId),
        isNull(receiptsTable.deletedAt),
      ),
    )
    .orderBy(desc(receiptsTable.id))
    .limit(1);

  return rows[0] ?? null;
}

function getOriginalInvoiceTotal(input: {
  subtotal?: unknown;
  taxAmount?: unknown;
  total?: unknown;
  advancePayment?: unknown;
}) {
  const subtotal = Number(input.subtotal ?? 0);
  const taxAmount = Number(input.taxAmount ?? 0);
  const grossTotal = subtotal + taxAmount;

  if (grossTotal > 0) return grossTotal;
  return Number(input.total ?? 0) + Number(input.advancePayment ?? 0);
}

async function getActiveReceiptTotal(
  invoiceId: number,
  excludeReceiptId?: number,
  database: ReturnType<typeof getLocalDb> = getLocalDb(),
): Promise<number> {
  const filters = [
    eq(receiptsTable.invoiceId, invoiceId),
    isNull(receiptsTable.deletedAt),
    eq(receiptsTable.status, "issued"),
  ];

  if (excludeReceiptId !== undefined) {
    filters.push(ne(receiptsTable.id, excludeReceiptId));
  }

  const receipts = await database
    .select({ amount: receiptsTable.amount })
    .from(receiptsTable)
    .where(and(...filters));

  return receipts.reduce((sum, receipt) => sum + Number(receipt.amount ?? 0), 0);
}

async function validateReceiptDoesNotExceedRemaining(
  invoiceId: number | null,
  amount: unknown,
  excludeReceiptId?: number,
  database: ReturnType<typeof getLocalDb> = getLocalDb(),
) {
  if (invoiceId === null) return { ok: true as const };

  const receiptAmount = Number(amount ?? 0);

  if (!Number.isFinite(receiptAmount)) {
    return { ok: false as const, status: 400, error: "Invalid amount" };
  }

  const [invoice] = await database
    .select()
    .from(invoicesTable)
    .where(and(eq(invoicesTable.id, invoiceId), isNull(invoicesTable.deletedAt)))
    .limit(1);

  if (!invoice) {
    return { ok: false as const, status: 400, error: "Invalid invoiceId" };
  }

  const originalTotal = getOriginalInvoiceTotal(invoice);
  const paidSoFar =
    Number(invoice.advancePayment ?? 0) +
    (await getActiveReceiptTotal(invoice.id, excludeReceiptId, database));
  const remaining = originalTotal - paidSoFar;

  if (receiptAmount > remaining + 0.000001) {
    return {
      ok: false as const,
      status: 400,
      error: "قيمة سند القبض أكبر من المتبقي على الفاتورة",
      errorEn: "Receipt amount exceeds the remaining invoice balance",
    };
  }

  return { ok: true as const };
}

export async function refreshInvoicePaidStatus(invoiceId: number | null | undefined) {
  refreshAndQueueInvoicePaymentStatus(invoiceId);
}

async function enqueueReceiptSyncChangeIfNeeded(input: {
  operation: "create" | "update";
  receipt: typeof receiptsTable.$inferSelect;
  userId?: number | string | null;
}) {
  const existing = await getLocalDb()
    .select({ id: syncQueueTable.id })
    .from(syncQueueTable)
    .where(
      and(
        eq(syncQueueTable.entityType, "receipt"),
        eq(syncQueueTable.entityId, String(input.receipt.id)),
        eq(syncQueueTable.operation, input.operation),
        eq(syncQueueTable.status, "pending"),
      ),
    )
    .limit(1);

  if (existing.length > 0) return;

  console.log("[SYNC][QUEUE][RECEIPT]", {
    operation: input.operation,
    receiptId: input.receipt.id,
  });

  await enqueueSyncChange({
    entityType: "receipt",
    entityId: input.receipt.id,
    action: input.operation,
    payload: {
      receiptId: input.receipt.id,
      receiptNumber: input.receipt.receiptNumber,
      invoiceId: input.receipt.invoiceId ?? null,
      clientId: input.receipt.clientId,
      amount: input.receipt.amount,
      paymentMethod: input.receipt.paymentMethod,
      receiptDate: input.receipt.receiptDate,
      status: input.receipt.status,
    },
    userId: input.userId ?? null,
  });
}

async function generateReceiptNumber(): Promise<string> {
  const year = new Date().getFullYear();

  const receipts = await getLocalDb()
    .select({ receiptNumber: receiptsTable.receiptNumber })
    .from(receiptsTable);

  let maxSeq = 0;

  for (const receipt of receipts) {
    const match = String(receipt.receiptNumber ?? "").match(
      new RegExp(`^RCP-${year}-(\\d+)$`)
    );

    if (match) {
      maxSeq = Math.max(maxSeq, Number(match[1]));
    }
  }

  const seq = String(maxSeq + 1).padStart(4, "0");

  return `RCP-${year}-${seq}`;
}

// List all receipts (non-deleted)
router.get("/receipts", requireAuth, async (req, res) => {
  try {
    const clientScope = await getClientScope(req);
    if (clientScope && (!clientScope.clientId || clientScope.permissions?.canViewReceipts === false)) {
      return res.status(403).json({ error: "Receipts are not allowed for this client user" });
    }
    const clientId = clientScope?.clientId ?? (req.query.clientId ? parseInt(req.query.clientId as string) : null);
    const isAdmin = req.user!.role === "admin" || req.user!.role === "supervisor" || req.user!.role === "client";
    const userId = req.user!.userId;

    const buildFilters = (extra: ReturnType<typeof and>[] = []) => {
      const filters: ReturnType<typeof and>[] = [isNull(receiptsTable.deletedAt), ...extra];
      if (!isAdmin) filters.push(eq(invoicesTable.createdBy, userId));
      return and(...filters);
    };

    let rows;

    if (clientId) {
      rows = await getLocalDb()
        .select()
        .from(receiptsTable)
        .leftJoin(invoicesTable, eq(receiptsTable.invoiceId, invoicesTable.id))
        .leftJoin(clientsTable, eq(receiptsTable.clientId, clientsTable.id))
        .leftJoin(usersTable, eq(usersTable.id, receiptsTable.createdBy))
        .where(buildFilters([eq(invoicesTable.clientId, clientId)]))
        .orderBy(desc(receiptsTable.id));
    } else {
      rows = await getLocalDb()
        .select()
        .from(receiptsTable)
        .leftJoin(invoicesTable, eq(receiptsTable.invoiceId, invoicesTable.id))
        .leftJoin(clientsTable, eq(receiptsTable.clientId, clientsTable.id))
        .leftJoin(usersTable, eq(usersTable.id, receiptsTable.createdBy))
        .where(buildFilters())
        .orderBy(desc(receiptsTable.id));
    }

    //----------------------------------------------
    const data = await Promise.all(
      rows.map(async (row) => {
        const [client] = await getLocalDb()
          .select()
          .from(clientsTable)
          .where(eq(clientsTable.id, Number(row.receipts.clientId)));

        let clientName = client?.name || "";
        let invoiceClient: typeof client | undefined = undefined;

        if (!clientName && row.invoices?.clientId) {
          [invoiceClient] = await getLocalDb()
            .select()
            .from(clientsTable)
            .where(eq(clientsTable.id, Number(row.invoices.clientId)));

          clientName = invoiceClient?.name || "";
        }

        console.log("ROW RECEIPT CLIENT ID:", row.receipts.clientId);
        console.log("ROW INVOICE CLIENT ID:", row.invoices?.clientId);
        console.log("CLIENT OBJECT:", client);
        console.log("INVOICE CLIENT OBJECT:", invoiceClient);
        console.log("FINAL CLIENT NAME:", clientName);

        return formatReceipt(
          row.receipts,
          clientName || "لا يوجد",
          row.invoices?.invoiceNumber || null,
          row.users?.displayNameEn || row.users?.displayName || "—",
        );
      }),
    );
    //------------------------------------------------------
    console.log("DATA AFTER FORMAT:", data);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }

  return undefined;
});

router.get("/receipts/by-invoice/:invoiceId", requireAuth, async (req, res) => {
  try {
    const invoiceId = Number(req.params.invoiceId);

    if (!Number.isSafeInteger(invoiceId) || invoiceId <= 0) {
      return res.status(400).json({ error: "Invalid invoice id" });
    }

    const clientScope = await getClientScope(req);
    if (clientScope && (!clientScope.clientId || clientScope.permissions?.canViewReceipts === false)) {
      return res.status(403).json({ error: "Receipts are not allowed for this client user" });
    }
    const isAdmin = req.user!.role === "admin" || req.user!.role === "supervisor" || req.user!.role === "client";
    const userId = req.user!.userId;

    const invoiceRows = await getLocalDb()
      .select()
      .from(invoicesTable)
      .where(and(isNull(invoicesTable.deletedAt),
        isAdmin
          ? clientScope
            ? and(eq(invoicesTable.id, invoiceId), eq(invoicesTable.clientId, clientScope.clientId))
            : eq(invoicesTable.id, invoiceId)
          : and(eq(invoicesTable.id, invoiceId), eq(invoicesTable.createdBy, userId)),
      ))
      .limit(1);

    if (!invoiceRows.length) {
      return res.status(404).json({ error: "Invoice not found" });
    }
    if (invoiceRows[0].status === "cancelled") {
      return res.status(409).json({ error: "Restore the invoice before linking a receipt" });
    }

    const row = await findActiveReceiptByInvoiceId(invoiceId);

    if (!row) {
      return res.json(null);
    }

    return res.json(
      formatReceipt(
        row.receipts,
        row.clients?.name || "",
        row.invoices?.invoiceNumber || null,
      ),
    );
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Create receipt
router.post("/receipts", requireAuth, async (req, res) => {
  try {
    if (rejectClientWrite(req, res)) return;
    const invoiceId =
      req.body.invoiceId === "" ||
      req.body.invoiceId === null ||
      req.body.invoiceId === undefined
        ? null
        : Number(req.body.invoiceId);

    if (invoiceId !== null && Number.isNaN(invoiceId)) {
      return res.status(400).json({ error: "Invalid invoiceId" });
    }

    if (invoiceId !== null) {
      const existingReceipt = await findActiveReceiptByInvoiceId(invoiceId);

      if (existingReceipt) {
        return res.status(409).json({
          error: "Receipt already exists for this invoice",
          receiptId: existingReceipt.receipts.id,
        });
      }
    }

    const receiptStatus = normalizeReceiptStatus(req.body.status, "draft");

    if (receiptStatus === "issued") {
      const remainingValidation = await validateReceiptDoesNotExceedRemaining(
        invoiceId,
        req.body.amount,
      );

      if (!remainingValidation.ok) {
        return res.status(remainingValidation.status).json({
          error: remainingValidation.error,
          errorEn: remainingValidation.errorEn,
        });
      }
    }

    const receiptNumber = await generateReceiptNumber();

    const clientId =
      req.body.clientId
        ? Number(req.body.clientId)
        : invoiceId
          ? (
              await getLocalDb()
                .select()
                .from(invoicesTable)
                .where(eq(invoicesTable.id, invoiceId))
            )[0]?.clientId ?? null
          : null;

    if (clientId === null || !Number.isSafeInteger(clientId) || clientId <= 0) {
      return res.status(400).json({ error: "A valid clientId is required" });
    }

    const [receipt] = await getLocalDb()
      .insert(receiptsTable)
      .values({
        receiptNumber,
        clientId,
        invoiceId,
        amount: Number(req.body.amount),
        paymentMethod: req.body.paymentMethod,
        status: receiptStatus,
        notes: req.body.notes || null,
        receiptDate: req.body.receiptDate || req.body.receivedAt,
        createdBy: req.user!.userId,
      })
      .returning();

    await syncIssuedReceiptLedgerEntry(receipt);

    await refreshInvoicePaidStatus(receipt.invoiceId);
    await enqueueReceiptSyncChangeIfNeeded({
      operation: "create",
      receipt,
      userId: req.user?.userId ?? (req as any).user?.id ?? null,
    });

    const [client] = receipt.clientId
      ? await getLocalDb()
          .select()
          .from(clientsTable)
          .where(eq(clientsTable.id, receipt.clientId))
      : [];

    const invoiceNumber = receipt.invoiceId
      ? (
          await getLocalDb()
            .select()
            .from(invoicesTable)
            .where(eq(invoicesTable.id, receipt.invoiceId))
        )[0]?.invoiceNumber || null
      : null;

    res.status(201).json(
      formatReceipt(
        receipt,
        client?.name || "",
        invoiceNumber,
      ),
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }

  return undefined;
});

//------Soft update receipt----------
router.put("/receipts/:id", requireAuth, async (req, res) => {
  try {
    if (rejectClientWrite(req, res)) return;
    const id = parseInt(String(req.params.id), 10);

    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid receipt id" });
    }

    const [oldReceipt] = await getLocalDb()
      .select()
      .from(receiptsTable)
      .where(eq(receiptsTable.id, id))
      .limit(1);

    if (!oldReceipt) {
      return res.status(404).json({ error: "Receipt not found" });
    }

    const invoiceId =
      req.body.invoiceId === "" ||
      req.body.invoiceId === null ||
      req.body.invoiceId === undefined
        ? null
        : Number(req.body.invoiceId);

    if (invoiceId !== null && Number.isNaN(invoiceId)) {
      return res.status(400).json({ error: "Invalid invoiceId" });
    }

    if (invoiceId !== null) {
      const existingReceipt = await findActiveReceiptByInvoiceId(invoiceId);

      if (existingReceipt && existingReceipt.receipts.id !== id) {
        return res.status(409).json({
          error: "Receipt already exists for this invoice",
          receiptId: existingReceipt.receipts.id,
        });
      }
    }

    const clientId =
      req.body.clientId !== undefined &&
      req.body.clientId !== null &&
      req.body.clientId !== ""
        ? Number(req.body.clientId)
        : invoiceId !== null
        ? (
            await getLocalDb()
              .select()
              .from(invoicesTable)
              .where(eq(invoicesTable.id, invoiceId))
          )[0]?.clientId ?? null
        : null;

    if (clientId !== null && Number.isNaN(clientId)) {
      return res.status(400).json({ error: "Invalid clientId" });
    }

    const amount =
      req.body.amount === "" ||
      req.body.amount === null ||
      req.body.amount === undefined
        ? null
        : req.body.amount;

    const targetInvoiceId =
      req.body.invoiceId === undefined ? oldReceipt.invoiceId ?? null : invoiceId;
    const targetAmount =
      req.body.amount === undefined ? oldReceipt.amount ?? 0 : amount ?? 0;
    const targetStatus = normalizeReceiptStatus(
      req.body.status,
      normalizeReceiptStatus(oldReceipt.status, "draft"),
    );

    if (targetStatus === "issued") {
      const remainingValidation = await validateReceiptDoesNotExceedRemaining(
        targetInvoiceId,
        targetAmount,
        id,
      );

      if (!remainingValidation.ok) {
        return res.status(remainingValidation.status).json({
          error: remainingValidation.error,
          errorEn: remainingValidation.errorEn,
        });
      }
    }

      const patchData: any = {};

      if (oldReceipt.receiptNumber.startsWith("REC-W-") && req.body.receiptNumber !== undefined && req.body.receiptNumber !== oldReceipt.receiptNumber) {
        return res.status(409).json({ error: "لا يمكن تغيير رقم سند الويب", errorEn: "Web receipt numbers cannot be changed" });
      }
      if (req.body.receiptNumber !== undefined) patchData.receiptNumber = req.body.receiptNumber;
      if (req.body.date !== undefined) patchData.receiptDate = req.body.date;
      if (req.body.receiptDate !== undefined) patchData.receiptDate = req.body.receiptDate;
      if (req.body.paymentMethod !== undefined) patchData.paymentMethod = req.body.paymentMethod;
      if (req.body.status !== undefined) patchData.status = targetStatus;
      if (req.body.notes !== undefined) patchData.notes = req.body.notes;
      if (req.body.invoiceId !== undefined) patchData.invoiceId = invoiceId;

      if (
        req.body.clientId !== undefined ||
        req.body.invoiceId !== undefined
      ) {
        patchData.clientId = clientId;
      }
      if (req.body.amount !== undefined) {
        patchData.amount = amount;
      }

    await getLocalDb()
      .update(receiptsTable)
      .set(patchData)
      .where(eq(receiptsTable.id, id));

    await refreshInvoicePaidStatus(oldReceipt?.invoiceId);
    await refreshInvoicePaidStatus(invoiceId);

    const [updatedReceipt] = await getLocalDb()
      .select()
      .from(receiptsTable)
      .where(eq(receiptsTable.id, id))
      .limit(1);

    if (updatedReceipt) {
      await syncIssuedReceiptLedgerEntry(updatedReceipt);

      await enqueueReceiptSyncChangeIfNeeded({
        operation: "update",
        receipt: updatedReceipt,
        userId: req.user?.userId ?? (req as any).user?.id ?? null,
      });
    }

    res.json({
      success: true,
      message: "Receipt updated successfully",
      id,
      patchData,
      ...(updatedReceipt ? formatReceipt(updatedReceipt, "", null) : {}),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }

  return undefined;
});

// Soft delete receipt (move to trash)
router.delete("/receipts/:id", requireAuth, async (req, res) => {
  try {
    if (rejectClientWrite(req, res)) return;
    const id = parseInt(String(req.params.id), 10);

    const [receipt] = await getLocalDb()
      .select()
      .from(receiptsTable)
      .where(eq(receiptsTable.id, id))
      .limit(1);

    if (!changeDocumentDeletion("receipt", id, false, req.user?.userId ?? null)) {
      res.status(404).json({ error: "Receipt not found" });
      return;
    }

    if (receipt) {
      await deleteReceiptLedgerEntry(receipt.id);
    }

    await refreshInvoicePaidStatus(receipt?.invoiceId);

    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export function formatReceipt(
  r: typeof receiptsTable.$inferSelect,
  clientName: string,
  invoiceNumber: string | null,
  receivedByName: string = "",
) {
  return {
    id: r.id,
    receiptNumber: r.receiptNumber,
    clientId: r.clientId,
    clientName,
    invoiceId: r.invoiceId ?? null,
    invoiceNumber,
    amount: Number(r.amount ?? 0),
    paymentMethod: r.paymentMethod,
    status: normalizeReceiptStatus(r.status, "draft"),
    notes: r.notes ?? null,
    receiptDate: r.receiptDate,
    deletedAt: r.deletedAt ?? null,
    receivedByName,
  };
}

router.post("/receipts/:id/issue", requireAuth, async (req, res) => {
  try {
    if (rejectClientWrite(req, res)) return;
    const id = parseInt(String(req.params.id), 10);

    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid receipt id" });
    }

    const [receipt] = await getLocalDb()
      .select()
      .from(receiptsTable)
      .where(and(eq(receiptsTable.id, id), isNull(receiptsTable.deletedAt)))
      .limit(1);

    if (!receipt) {
      return res.status(404).json({ error: "Receipt not found" });
    }

    if (receipt.status === "cancelled") {
      return res.status(409).json({ error: "حوّل السند الملغى إلى مسودة للمراجعة قبل إصداره", errorEn: "Change the cancelled receipt to draft before issuing" });
    }

    if (receipt.status !== "issued") {
      const remainingValidation = await validateReceiptDoesNotExceedRemaining(
        receipt.invoiceId ?? null,
        receipt.amount,
        receipt.id,
      );

      if (!remainingValidation.ok) {
        return res.status(remainingValidation.status).json({
          error: remainingValidation.error,
          errorEn: remainingValidation.errorEn,
        });
      }
    }

    const [issuedReceipt] = await getLocalDb()
      .update(receiptsTable)
      .set({ status: "issued" })
      .where(eq(receiptsTable.id, id))
      .returning();

    await syncIssuedReceiptLedgerEntry(issuedReceipt);
    await refreshInvoicePaidStatus(issuedReceipt.invoiceId);
    await enqueueReceiptSyncChangeIfNeeded({
      operation: "update",
      receipt: issuedReceipt,
      userId: req.user?.userId ?? (req as any).user?.id ?? null,
    });

    const [client] = issuedReceipt.clientId
      ? await getLocalDb()
          .select()
          .from(clientsTable)
          .where(eq(clientsTable.id, issuedReceipt.clientId))
      : [];

    const invoiceNumber = issuedReceipt.invoiceId
      ? (
          await getLocalDb()
            .select()
            .from(invoicesTable)
            .where(eq(invoicesTable.id, issuedReceipt.invoiceId))
        )[0]?.invoiceNumber || null
      : null;

    return res.json(formatReceipt(issuedReceipt, client?.name || "", invoiceNumber));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/receipts/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);

    const rows = await getLocalDb()
      .select()
      .from(receiptsTable)
      .leftJoin(invoicesTable, eq(receiptsTable.invoiceId, invoicesTable.id))
      .leftJoin(clientsTable, eq(receiptsTable.clientId, clientsTable.id))
      .leftJoin(usersTable, eq(usersTable.id, receiptsTable.createdBy))
      .where(eq(receiptsTable.id, id));

    if (!rows.length) {
      return res.status(404).json({ error: "Receipt not found" });
    }

    const row = rows[0];
    const clientScope = await getClientScope(req);
    const receiptClientId = row.receipts.clientId ?? row.invoices?.clientId ?? null;
    if (clientScope && (!clientScope.clientId || receiptClientId !== clientScope.clientId || clientScope.permissions?.canViewReceipts === false)) {
      return res.status(403).json({ error: "Receipt is not allowed for this client user" });
    }

    res.json(
      formatReceipt(
        row.receipts,
        row.clients?.name || "",
        row.invoices?.invoiceNumber || null,
        row.users?.displayNameEn || row.users?.displayName || "غير محدد"
      ),
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }

  return undefined;
});

router.post("/receipts/import", requireAuth, async (req, res) => {
  try {
    if (rejectClientWrite(req, res)) return;
    const rows = req.body.data;

    if (!Array.isArray(rows)) {
      return res.status(400).json({ error: "Invalid data" });
    }

    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    let duplicates = 0;
    let drafted = 0;
    const errors: Array<{ receiptNumber: string; reason: string }> = [];
    const invoiceIdMap = req.body.invoiceIdMap as Record<string, number> | undefined;
    const clientIdMap = req.body.clientIdMap as Record<string, number> | undefined;

    for (const row of rows) {
      const receiptNumber = String(row.receiptNumber ?? "").trim();
      if (!receiptNumber) {
        skipped++;
        errors.push({ receiptNumber, reason: "Missing receipt number" });
        continue;
      }
      const clientId = clientIdMap ? Number(clientIdMap[String(row.clientId)]) : Number(row.clientId);
      const [client] = await getLocalDb().select({ id: clientsTable.id }).from(clientsTable)
        .where(eq(clientsTable.id, clientId)).limit(1);
      if (!client) {
        skipped++;
        errors.push({ receiptNumber, reason: "Client not found" });
        continue;
      }
      const sourceInvoiceId = row.invoiceId ? String(row.invoiceId) : null;
      const mappedInvoiceId = sourceInvoiceId && invoiceIdMap
        ? Number(invoiceIdMap[sourceInvoiceId])
        : null;
      const invoiceNumber = String(row.invoiceNumber ?? "").trim();
      let invoice: typeof invoicesTable.$inferSelect | null = null;
      if (sourceInvoiceId && invoiceIdMap) {
        // A full restore must use the ID returned by the invoice import.
        if (Number.isInteger(mappedInvoiceId) && mappedInvoiceId! > 0) {
          [invoice] = await getLocalDb().select().from(invoicesTable)
            .where(and(eq(invoicesTable.id, mappedInvoiceId!), isNull(invoicesTable.deletedAt))).limit(1);
        }
      } else if (invoiceNumber) {
        [invoice] = await getLocalDb().select().from(invoicesTable)
          .where(and(eq(invoicesTable.invoiceNumber, invoiceNumber), isNull(invoicesTable.deletedAt))).limit(1);
      } else if (sourceInvoiceId) {
        // Legacy backups without an invoice number can only use an ID when
        // the matching invoice really belongs to the same client.
        [invoice] = await getLocalDb().select().from(invoicesTable)
          .where(and(eq(invoicesTable.id, Number(sourceInvoiceId)), isNull(invoicesTable.deletedAt))).limit(1);
      }
      if (sourceInvoiceId && (!invoice || invoice.clientId !== clientId)) {
        skipped++;
        errors.push({ receiptNumber, reason: "Invoice not found or client does not match" });
        continue;
      }
      const [numberMatch] = await getLocalDb()
        .select()
        .from(receiptsTable)
        .where(eq(receiptsTable.receiptNumber, receiptNumber))
        .limit(1);
      const targetInvoiceId = invoice?.id ?? null;
      const sameDocument = (receipt: typeof receiptsTable.$inferSelect) =>
        receipt.clientId === clientId && receipt.invoiceId === targetInvoiceId;
      let existing = numberMatch && sameDocument(numberMatch) ? numberMatch : undefined;
      let finalReceiptNumber = receiptNumber;

      // A receipt number already used by another invoice/client belongs to
      // that receipt. Assign a numbered copy instead of overwriting it.
      if (numberMatch && !existing) {
        const base = receiptNumber.replace(/\s*\(\d+\)$/, "");
        for (let counter = 1; ; counter++) {
          const candidate = `${base} (${counter})`;
          const [used] = await getLocalDb().select().from(receiptsTable)
            .where(eq(receiptsTable.receiptNumber, candidate)).limit(1);
          if (!used) {
            finalReceiptNumber = candidate;
            break;
          }
          if (sameDocument(used)) {
            finalReceiptNumber = candidate;
            existing = used;
            break;
          }
        }
      }

      const values = {
        receiptNumber: finalReceiptNumber,
        clientId,
        invoiceId: targetInvoiceId,
        amount: Number(row.amount ?? 0),
        paymentMethod: row.paymentMethod ?? "cash",
        status: normalizeReceiptStatus(row.status, "issued"),
        notes: row.notes ?? null,
        receiptDate: row.receiptDate
          ? String(row.receiptDate)
          : new Date().toISOString().slice(0, 10),
        deletedAt: null,
      };

      if (targetInvoiceId !== null) {
        const invoiceReceipts = await getLocalDb().select().from(receiptsTable).where(and(
          eq(receiptsTable.invoiceId, targetInvoiceId),
          isNull(receiptsTable.deletedAt),
        ));
        const duplicate = invoiceReceipts.some((receipt) =>
          receipt.id !== existing?.id &&
          receipt.clientId === clientId &&
          receipt.status === values.status &&
          Math.abs(Number(receipt.amount) - Number(values.amount)) < 0.000001
        );
        if (duplicate) {
          duplicates++;
          continue;
        }
      }

      let convertedToDraft = false;
      if (values.status === "issued") {
        const remainingValidation = await validateReceiptDoesNotExceedRemaining(
          values.invoiceId,
          values.amount,
          existing?.id,
        );

        if (!remainingValidation.ok) {
          if (remainingValidation.error === "قيمة سند القبض أكبر من المتبقي على الفاتورة") {
            values.status = "draft";
            convertedToDraft = true;
          } else {
            skipped++;
            errors.push({
              receiptNumber,
              reason: "errorEn" in remainingValidation
                ? remainingValidation.errorEn ?? remainingValidation.error
                : remainingValidation.error,
            });
            continue;
          }
        }
      }

      if (existing &&
        existing.deletedAt === null &&
        existing.receiptNumber === values.receiptNumber &&
        existing.invoiceId === values.invoiceId &&
        Number(existing.amount) === Number(values.amount) &&
        existing.status === values.status &&
        existing.paymentMethod === values.paymentMethod &&
        existing.receiptDate === values.receiptDate &&
        (existing.notes ?? null) === values.notes) {
        duplicates++;
        continue;
      }

      if (existing) {
        await getLocalDb()
          .update(receiptsTable)
          .set(values)
          .where(eq(receiptsTable.id, existing.id));

        const [updatedReceipt] = await getLocalDb()
          .select()
          .from(receiptsTable)
          .where(eq(receiptsTable.id, existing.id))
          .limit(1);

        if (updatedReceipt) {
          await syncIssuedReceiptLedgerEntry(updatedReceipt);
        }

        await refreshInvoicePaidStatus(existing.invoiceId);
        await refreshInvoicePaidStatus(values.invoiceId);
        updated++;
        if (convertedToDraft) drafted++;
      } else {
        const [insertedReceipt] = await getLocalDb().insert(receiptsTable).values(values).returning();
        await syncIssuedReceiptLedgerEntry(insertedReceipt);
        await refreshInvoicePaidStatus(values.invoiceId);
        inserted++;
        if (convertedToDraft) drafted++;
      }
    }

    return res.json({ ok: true, inserted, updated, duplicates, drafted, skipped, errors });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Import failed" });
  }
});

export default router;
