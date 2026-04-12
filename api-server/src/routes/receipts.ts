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
      if (!isAdmin) filters.push(eq(invoicesTable.createdBy, userId));
      return and(...filters);
    };

    let rows;

    if (clientId) {
      rows = await db
        .select()
        .from(receiptsTable)
        .leftJoin(invoicesTable, eq(receiptsTable.invoiceId, invoicesTable.id))
        .leftJoin(clientsTable, eq(invoicesTable.clientId, clientsTable.id))
        .where(buildFilters([eq(invoicesTable.clientId, clientId)]))
        .orderBy(desc(receiptsTable.id));
    } else {
      rows = await db
        .select()
        .from(receiptsTable)
        .leftJoin(invoicesTable, eq(receiptsTable.invoiceId, invoicesTable.id))
        .leftJoin(clientsTable, eq(invoicesTable.clientId, clientsTable.id))
        .where(buildFilters())
        .orderBy(desc(receiptsTable.id));
    }

    const data = rows.map((row) =>
      formatReceipt(
        row.receipts,
        row.clients?.nameEn || row.clients?.nameAr || row.clients?.name || "",
        row.invoices?.invoiceNumber || null,
      ),
    );

    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Create receipt
router.post("/receipts", requireAuth, async (req, res) => {
  try {
    const receiptNumber = await generateReceiptNumber();

    const [receipt] = await db
      .insert(receiptsTable)
      .values({
        receiptNumber,
        clientId: Number(req.body.clientId),
        invoiceId: req.body.invoiceId ? Number(req.body.invoiceId) : null,
        amount: String(req.body.amount),
        paymentMethod: req.body.paymentMethod,
        notes: req.body.notes || null,
        receiptDate: req.body.receiptDate || req.body.receivedAt,
      })
      .returning();

    const [client] = await db
      .select()
      .from(clientsTable)
      .where(eq(clientsTable.id, receipt.clientId));

    const invoiceNumber = receipt.invoiceId
      ? (
          await db
            .select()
            .from(invoicesTable)
            .where(eq(invoicesTable.id, receipt.invoiceId))
        )[0]?.invoiceNumber || null
      : null;

    res.status(201).json(
      formatReceipt(
        receipt,
        client?.nameEn || client?.nameAr || client?.name || "",
        invoiceNumber,
      ),
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Soft delete receipt (move to trash)
router.delete("/receipts/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    await db
      .update(receiptsTable)
      .set({ deletedAt: new Date() })
      .where(and(eq(receiptsTable.id, id), isNull(receiptsTable.deletedAt)));

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
) {
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
    receivedAt: r.receiptDate,
    deletedAt: r.deletedAt ?? null,
  };
}

router.get("/receipts/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const rows = await db
      .select()
      .from(receiptsTable)
      .leftJoin(invoicesTable, eq(receiptsTable.invoiceId, invoicesTable.id))
      .leftJoin(clientsTable, eq(invoicesTable.clientId, clientsTable.id))
      .where(eq(receiptsTable.id, id));

    if (!rows.length) {
      return res.status(404).json({ error: "Receipt not found" });
    }

    const row = rows[0];

    res.json(
      formatReceipt(
        row.receipts,
        row.clients?.nameEn || row.clients?.nameAr || row.clients?.name || "",
        row.invoices?.invoiceNumber || null,
      ),
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
