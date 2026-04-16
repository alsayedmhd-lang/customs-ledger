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
        .leftJoin(clientsTable, eq(receiptsTable.clientId, clientsTable.id))
        .where(buildFilters([eq(invoicesTable.clientId, clientId)]))
        .orderBy(desc(receiptsTable.id));
    } else {
      rows = await db
        .select()
        .from(receiptsTable)
        .leftJoin(invoicesTable, eq(receiptsTable.invoiceId, invoicesTable.id))
        .leftJoin(clientsTable, eq(receiptsTable.clientId, clientsTable.id))
        .where(buildFilters())
        .orderBy(desc(receiptsTable.id));
    }
    
    //----------------------------------------------
    const data = await Promise.all(
      rows.map(async (row) => {
        const [client] = await db
          .select()
          .from(clientsTable)
          .where(eq(clientsTable.id, Number(row.receipts.clientId)));
    
        let clientName = client?.name || "";
        let invoiceClient: typeof client | undefined = undefined;
    
        if (!clientName && row.invoices?.clientId) {
          [invoiceClient] = await db
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
});

// Create receipt
router.post("/receipts", requireAuth, async (req, res) => {
  try {
    const receiptNumber = await generateReceiptNumber();

    const clientId =
      req.body.clientId
        ? Number(req.body.clientId)
        : req.body.invoiceId
          ? (
              await db
                .select()
                .from(invoicesTable)
                .where(eq(invoicesTable.id, Number(req.body.invoiceId)))
            )[0]?.clientId ?? null
          : null;

    const [receipt] = await db
      .insert(receiptsTable)
      .values({
        receiptNumber,
        clientId,
        invoiceId: req.body.invoiceId ? Number(req.body.invoiceId) : null,
        amount: String(req.body.amount),
        paymentMethod: req.body.paymentMethod,
        notes: req.body.notes || null,
        receiptDate: req.body.receiptDate || req.body.receivedAt,
      })
      .returning();

    const [client] = receipt.clientId
      ? await db
          .select()
          .from(clientsTable)
          .where(eq(clientsTable.id, receipt.clientId))
      : [];

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
        client?.name || "",
        invoiceNumber,
      ),
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

//------Soft update receipt----------
router.put("/receipts/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid receipt id" });
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

    const clientId =
      req.body.clientId !== undefined &&
      req.body.clientId !== null &&
      req.body.clientId !== ""
        ? Number(req.body.clientId)
        : invoiceId !== null
        ? (
            await db
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

      const patchData: any = {};
      
      if (req.body.receiptNumber !== undefined) patchData.receiptNumber = req.body.receiptNumber;
      if (req.body.date !== undefined) patchData.date = req.body.date;
      if (req.body.paymentMethod !== undefined) patchData.paymentMethod = req.body.paymentMethod;
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

    await db
      .update(receiptsTable)
      .set(patchData)
      .where(eq(receiptsTable.id, id));
    res.json({
      success: true,
      message: "Receipt updated successfully",
      id,
      patchData,
    });
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
    receiptDate: r.receiptDate,
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
      .leftJoin(clientsTable, eq(receiptsTable.clientId, clientsTable.id))
      .where(eq(receiptsTable.id, id));

    if (!rows.length) {
      return res.status(404).json({ error: "Receipt not found" });
    }

    const row = rows[0];

    res.json(
      formatReceipt(
        row.receipts,
        row.clients?.name || "",
        row.invoices?.invoiceNumber || null,
      ),
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
