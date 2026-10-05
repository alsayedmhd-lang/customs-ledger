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
import { formatReceipt } from "./receipts";
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
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Restore invoice from trash
router.post("/trash/invoices/:id/restore", async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const [invoice] = await getLocalDb()
      .update(invoicesTable)
      .set({ deletedAt: null })
      .where(and(eq(invoicesTable.id, id), isNotNull(invoicesTable.deletedAt)))
      .returning();

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
      after: { deletedAt: null },
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
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Permanently delete invoice from trash
router.delete("/trash/invoices/:id", async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    await getLocalDb().delete(invoiceItemsTable).where(eq(invoiceItemsTable.invoiceId, id));
    await getLocalDb().delete(invoicesTable).where(eq(invoicesTable.id, id));
    res.status(204).send();
  } catch (err) {
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
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Restore receipt from trash
router.post("/trash/receipts/:id/restore", async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const [receipt] = await getLocalDb()
      .update(receiptsTable)
      .set({ deletedAt: null })
      .where(and(eq(receiptsTable.id, id), isNotNull(receiptsTable.deletedAt)))
      .returning();

    if (!receipt) {
      res.status(404).json({ error: "Receipt not found in trash" });
      return;
    }

    const [client] = await getLocalDb().select().from(clientsTable).where(eq(clientsTable.id, receipt.clientId));
    res.json(formatReceipt(receipt, client?.name ?? "", null));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Permanently delete receipt from trash
router.delete("/trash/receipts/:id", async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    await getLocalDb().delete(receiptsTable).where(eq(receiptsTable.id, id));
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
