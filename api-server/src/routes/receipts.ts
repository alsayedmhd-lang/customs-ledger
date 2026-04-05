import { Router, type IRouter } from "express";
import { db, receiptsTable, clientsTable, invoicesTable } from "@workspace/db";
import { eq, desc, isNull, and } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";

const router: IRouter = Router();

async function generateReceiptNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await db.$count(receiptsTable);
  const seq = String(count + 1).padStart(4, "0");
  return `RCP-${year}-${seq}`;
}

// List all receipts (non-deleted)
router.get("/receipts", requireAuth, async (req, res) => {
  try {
    const clientId = req.query.clientId ? parseInt(req.query.clientId as string) : null;
    const isAdmin = req.user!.role === "admin" || req.user!.role === "supervisor";
    const userId = req.user!.userId;

    const buildFilters = (extra: ReturnType<typeof and>[] = []) => {
      const filters: ReturnType<typeof and>[] = [isNull(receiptsTable.deletedAt), ...extra];
      // Non-admins: only receipts whose linked invoice was created by them
      if (!isAdmin) filters.push(eq(invoicesTable.createdBy, userId));
      return and(...filters);
    };

    let rows;
    if (clientId) {
      rows = await db
        .select()
        .from(receiptsTable)
        .leftJoin(clientsTable, eq(receiptsTable.clientId, clientsTable.id))
        .leftJoin(invoicesTable, eq(receiptsTable.invoiceId, invoicesTable.id))
        .where(buildFilters([eq(receiptsTable.clientId, clientId)]))
        .orderBy(desc(receiptsTable.createdAt));
    } else {
      rows = await db
        .select()
        .from(receiptsTable)
        .leftJoin(clientsTable, eq(receiptsTable.clientId, clientsTable.id))
        .leftJoin(invoicesTable, eq(receiptsTable.invoiceId, invoicesTable.id))
        .where(buildFilters())
        .orderBy(desc(receiptsTable.createdAt));
    }

    res.json(rows.map(r => formatReceipt(r.receipts, r.clients?.name ?? "", r.invoices?.invoiceNumber ?? null)));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Create receipt
router.post("/receipts", async (req, res) => {
  try {
    const { clientId, invoiceId, amount, paymentMethod, notes, receiptDate } = req.body;

    if (!clientId || !amount || !receiptDate) {
      res.status(400).json({ error: "clientId, amount, and receiptDate are required" });
      return;
    }

    const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, clientId));
    if (!client) {
      res.status(400).json({ error: "Client not found" });
      return;
    }

    const receiptNumber = await generateReceiptNumber();

    const [receipt] = await db
      .insert(receiptsTable)
      .values({
        receiptNumber,
        clientId,
        invoiceId: invoiceId ? parseInt(invoiceId) : null,
        amount: parseFloat(amount).toFixed(2),
        paymentMethod: paymentMethod ?? "cash",
        notes: notes ?? null,
        receiptDate,
      })
      .returning();

    let invoiceNumber: string | null = null;
    if (receipt.invoiceId) {
      const [inv] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, receipt.invoiceId));
      invoiceNumber = inv?.invoiceNumber ?? null;
    }

    res.status(201).json(formatReceipt(receipt, client.name, invoiceNumber));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get single receipt
router.get("/receipts/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const rows = await db
      .select()
      .from(receiptsTable)
      .leftJoin(clientsTable, eq(receiptsTable.clientId, clientsTable.id))
      .leftJoin(invoicesTable, eq(receiptsTable.invoiceId, invoicesTable.id))
      .where(and(eq(receiptsTable.id, id), isNull(receiptsTable.deletedAt)));

    if (!rows.length) {
      res.status(404).json({ error: "Receipt not found" });
      return;
    }

    const r = rows[0];
    res.json(formatReceipt(r.receipts, r.clients?.name ?? "", r.invoices?.invoiceNumber ?? null));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update receipt
router.put("/receipts/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { clientId, invoiceId, amount, paymentMethod, notes, receiptDate } = req.body;

    const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, clientId));
    if (!client) {
      res.status(400).json({ error: "Client not found" });
      return;
    }

    const [receipt] = await db
      .update(receiptsTable)
      .set({
        clientId,
        invoiceId: invoiceId ? parseInt(invoiceId) : null,
        amount: parseFloat(amount).toFixed(2),
        paymentMethod: paymentMethod ?? "cash",
        notes: notes ?? null,
        receiptDate,
      })
      .where(and(eq(receiptsTable.id, id), isNull(receiptsTable.deletedAt)))
      .returning();

    if (!receipt) {
      res.status(404).json({ error: "Receipt not found" });
      return;
    }

    let invoiceNumber: string | null = null;
    if (receipt.invoiceId) {
      const [inv] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, receipt.invoiceId));
      invoiceNumber = inv?.invoiceNumber ?? null;
    }

    res.json(formatReceipt(receipt, client.name, invoiceNumber));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Soft delete receipt (move to trash)
router.delete("/receipts/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db
      .update(receiptsTable)
      .set({ deletedAt: new Date() })
      .where(and(eq(receiptsTable.id, id), isNull(receiptsTable.deletedAt)));
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export function formatReceipt(r: typeof receiptsTable.$inferSelect, clientName: string, invoiceNumber: string | null) {
  return {
    id: r.id,
    receiptNumber: r.receiptNumber,
    clientId: r.clientId,
    clientName,
    invoiceId: r.invoiceId ?? null,
    invoiceNumber,
    amount: parseFloat(r.amount ?? "0"),
    paymentMethod: r.paymentMethod,
    notes: r.notes ?? null,
    receiptDate: r.receiptDate,
    deletedAt: r.deletedAt ? r.deletedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
  };
}

export default router;
