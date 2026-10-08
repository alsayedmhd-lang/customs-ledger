import { getLocalDb } from "../utils/local-db";
import {
  invoicesTable,
  invoiceItemsTable,
  clientsTable,
  receiptsTable,
} from "@workspace/db/schema";
import { invoiceAuditLogsTableSqlite } from "../../../lib/db/src/schema/invoices-sqlite";
import { eq, desc, isNotNull, and } from "drizzle-orm";

import { formatInvoice, formatItem } from "./invoices";
import { formatReceipt, refreshInvoicePaidStatus, syncIssuedReceiptLedgerEntry } from "./receipts";
import { changeDocumentDeletion, permanentlyDeleteDocument } from "../utils/document-deletion-sync";
import { Router } from "express";

const router = Router();

router.use((req, res, next) => {
  if (!req.path.startsWith("/trash")) {
    if (req.originalUrl.includes("customer-ledger")) {
      console.log("[customer-ledger trace] after requireAuth guard name=trashRouter allowed=skip_non_trash", {
        role: (req as any).user?.role,
        path: req.path,
        originalUrl: req.originalUrl,
      });
    }
    return next();
  }

  if ((req as any).user?.role === "client") {
    if (req.originalUrl.includes("customer-ledger")) {
      console.log("[customer-ledger 403] reason=trash_router_client_guard", {
        role: (req as any).user?.role,
        path: req.path,
        originalUrl: req.originalUrl,
      });
    }
    return res.status(403).json({ error: "Trash is not allowed for client users" });
  }
  next();
});

// ─── Invoices Trash ───────────────────────────────────────────────────────────

// List deleted invoices
router.get("/trash/invoices", async (req, res) => {
  try {
    const rows = await getLocalDb()
      .select()
      .from(invoicesTable)
      .innerJoin(clientsTable, eq(invoicesTable.clientId, clientsTable.id))
      .where(isNotNull(invoicesTable.deletedAt))
      .orderBy(desc(invoicesTable.deletedAt));

    const invoicesWithItems = await Promise.all(
      rows.map(async (row) => {
        const items = await getLocalDb()
          .select()
          .from(invoiceItemsTable)
          .where(eq(invoiceItemsTable.invoiceId, row.invoices.id));
        return {
          ...formatInvoice(row.invoices, row.clients.name),
          items: items.map(formatItem),
        };
      })
    );

    res.json(invoicesWithItems);
  } catch (err) {
    if (err instanceof Error && err.message === "RESTORE_INVOICE_FIRST") {
      res.status(409).json({ error: "استعد الفاتورة المرتبطة أولاً", errorEn: "Restore the linked invoice first" });
      return;
    }
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Restore invoice from trash
router.post("/trash/invoices/:id/restore", async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (!changeDocumentDeletion("invoice", id, true, (req as any).user?.userId ?? null)) {
      res.status(404).json({ error: "Document not found in trash" });
      return;
    }
    const [invoice] = await getLocalDb().select().from(invoicesTable).where(eq(invoicesTable.id, id));

    if (!invoice) {
      res.status(404).json({ error: "Invoice not found in trash" });
      return;
    }

  await getLocalDb().insert(invoiceAuditLogsTableSqlite).values({
    invoiceId: invoice.id,
    action: "restored",
    userId: null,
    username: "admin",
    userEmail: null,
    userPhone: null,
    changesJson: JSON.stringify({
      before: { deletedAt: "not_null" },
      after: { deletedAt: null, status: "draft" },
    }),
    createdAt: new Date(),
  });

    const [client] = await getLocalDb().select().from(clientsTable).where(eq(clientsTable.id, invoice.clientId));
    const items = await getLocalDb()
      .select()
      .from(invoiceItemsTable)
      .where(eq(invoiceItemsTable.invoiceId, invoice.id));

    res.json({
      ...formatInvoice(invoice, client?.name ?? ""),
      items: items.map(formatItem),
    });
  } catch (err) {
    if (err instanceof Error && err.message === "RESTORE_INVOICE_FIRST") {
      res.status(409).json({ error: "استعد الفاتورة المرتبطة أولاً", errorEn: "Restore the linked invoice first" });
      return;
    }
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Permanently delete invoice from trash
router.delete("/trash/invoices/:id", async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    permanentlyDeleteDocument("invoice", id, (req as any).user?.userId ?? null);
    res.status(204).send();
  } catch (err) {
    if (err instanceof Error && err.message === "RESTORE_INVOICE_FIRST") {
      res.status(409).json({ error: "استعد الفاتورة المرتبطة أولاً", errorEn: "Restore the linked invoice first" });
      return;
    }
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Receipts Trash ───────────────────────────────────────────────────────────

// List deleted receipts
router.get("/trash/receipts", async (req, res) => {
  try {
    const rows = await getLocalDb()
      .select()
      .from(receiptsTable)
      .leftJoin(clientsTable, eq(receiptsTable.clientId, clientsTable.id))
      .where(isNotNull(receiptsTable.deletedAt))
      .orderBy(desc(receiptsTable.deletedAt));

    res.json(rows.map(r => formatReceipt(r.receipts, r.clients?.name ?? "", null)));
  } catch (err) {
    if (err instanceof Error && err.message === "RESTORE_INVOICE_FIRST") {
      res.status(409).json({ error: "استعد الفاتورة المرتبطة أولاً", errorEn: "Restore the linked invoice first" });
      return;
    }
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Restore receipt from trash
router.post("/trash/receipts/:id/restore", async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (!changeDocumentDeletion("receipt", id, true, (req as any).user?.userId ?? null)) {
      res.status(404).json({ error: "Document not found in trash" });
      return;
    }
    const [receipt] = await getLocalDb().select().from(receiptsTable).where(eq(receiptsTable.id, id));

    if (!receipt) {
      res.status(404).json({ error: "Receipt not found in trash" });
      return;
    }

    await refreshInvoicePaidStatus(receipt.invoiceId);
    await syncIssuedReceiptLedgerEntry(receipt);
    const [client] = await getLocalDb().select().from(clientsTable).where(eq(clientsTable.id, receipt.clientId));
    res.json(formatReceipt(receipt, client?.name ?? "", null));
  } catch (err) {
    if (err instanceof Error && err.message === "RESTORE_INVOICE_FIRST") {
      res.status(409).json({ error: "استعد الفاتورة المرتبطة أولاً", errorEn: "Restore the linked invoice first" });
      return;
    }
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Permanently delete receipt from trash
router.delete("/trash/receipts/:id", async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    permanentlyDeleteDocument("receipt", id, (req as any).user?.userId ?? null);
    res.status(204).send();
  } catch (err) {
    if (err instanceof Error && err.message === "RESTORE_INVOICE_FIRST") {
      res.status(409).json({ error: "استعد الفاتورة المرتبطة أولاً", errorEn: "Restore the linked invoice first" });
      return;
    }
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
