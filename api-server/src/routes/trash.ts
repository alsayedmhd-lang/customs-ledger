import { Router, type IRouter } from "express";
import { db, invoicesTable, invoiceItemsTable, clientsTable, receiptsTable } from "@workspace/db";
import { eq, desc, isNotNull, and } from "drizzle-orm";
import { formatInvoice, formatItem } from "./invoices";
import { formatReceipt } from "./receipts";

const router: IRouter = Router();

// ─── Invoices Trash ───────────────────────────────────────────────────────────

// List deleted invoices
router.get("/trash/invoices", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(invoicesTable)
      .innerJoin(clientsTable, eq(invoicesTable.clientId, clientsTable.id))
      .where(isNotNull(invoicesTable.deletedAt))
      .orderBy(desc(invoicesTable.deletedAt));

    const invoicesWithItems = await Promise.all(
      rows.map(async (row) => {
        const items = await db
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
    const id = parseInt(req.params.id);
    const [invoice] = await db
      .update(invoicesTable)
      .set({ deletedAt: null })
      .where(and(eq(invoicesTable.id, id), isNotNull(invoicesTable.deletedAt)))
      .returning();

    if (!invoice) {
      res.status(404).json({ error: "Invoice not found in trash" });
      return;
    }

    const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, invoice.clientId));
    const items = await db
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
    const id = parseInt(req.params.id);
    await db.delete(invoiceItemsTable).where(eq(invoiceItemsTable.invoiceId, id));
    await db.delete(invoicesTable).where(eq(invoicesTable.id, id));
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
    const rows = await db
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
    const id = parseInt(req.params.id);
    const [receipt] = await db
      .update(receiptsTable)
      .set({ deletedAt: null })
      .where(and(eq(receiptsTable.id, id), isNotNull(receiptsTable.deletedAt)))
      .returning();

    if (!receipt) {
      res.status(404).json({ error: "Receipt not found in trash" });
      return;
    }

    const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, receipt.clientId));
    res.json(formatReceipt(receipt, client?.name ?? "", null));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Permanently delete receipt from trash
router.delete("/trash/receipts/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(receiptsTable).where(eq(receiptsTable.id, id));
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
