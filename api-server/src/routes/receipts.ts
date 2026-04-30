import { Router, type IRouter } from "express";
import { db, sqlite, receiptsTable, clientsTable, invoicesTable } from "@workspace/db";
import { eq, desc, isNull, and } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";

const router: IRouter = Router();

function ensureUniqueActiveReceiptPerInvoice() {
  if (!sqlite) return;

  try {
    sqlite.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS receipts_invoice_id_unique_active
      ON receipts(invoice_id)
      WHERE invoice_id IS NOT NULL AND deleted_at IS NULL;
    `);
  } catch (error) {
    console.error("Failed to ensure receipts invoice unique index:", error);
  }
}

ensureUniqueActiveReceiptPerInvoice();

async function findActiveReceiptByInvoiceId(invoiceId: number) {
  const rows = await db
    .select()
    .from(receiptsTable)
    .leftJoin(invoicesTable, eq(receiptsTable.invoiceId, invoicesTable.id))
    .leftJoin(clientsTable, eq(receiptsTable.clientId, clientsTable.id))
    .where(
      and(
        eq(receiptsTable.invoiceId, invoiceId),
        isNull(receiptsTable.deletedAt),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

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

router.get("/receipts/by-invoice/:invoiceId", requireAuth, async (req, res) => {
  try {
    const invoiceId = Number(req.params.invoiceId);

    if (Number.isNaN(invoiceId) || invoiceId <= 0) {
      return res.status(400).json({ error: "Invalid invoice id" });
    }

    const isAdmin = req.user!.role === "admin" || req.user!.role === "supervisor";
    const userId = req.user!.userId;

    const invoiceRows = await db
      .select()
      .from(invoicesTable)
      .where(
        isAdmin
          ? eq(invoicesTable.id, invoiceId)
          : and(eq(invoicesTable.id, invoiceId), eq(invoicesTable.createdBy, userId)),
      )
      .limit(1);

    if (!invoiceRows.length) {
      return res.json(null);
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

    const receiptNumber = await generateReceiptNumber();

    const clientId =
      req.body.clientId
        ? Number(req.body.clientId)
        : invoiceId
          ? (
              await db
                .select()
                .from(invoicesTable)
                .where(eq(invoicesTable.id, invoiceId))
            )[0]?.clientId ?? null
          : null;

    const [receipt] = await db
      .insert(receiptsTable)
      .values({
        receiptNumber,
        clientId,
        invoiceId,
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
      if (req.body.date !== undefined) patchData.receiptDate = req.body.date;
      if (req.body.receiptDate !== undefined) patchData.receiptDate = req.body.receiptDate;
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

router.post("/receipts/import", requireAuth, async (req, res) => {
  try {
    const rows = req.body.data;

    if (!Array.isArray(rows)) {
      return res.status(400).json({ error: "Invalid data" });
    }

    let inserted = 0;
    let updated = 0;

    for (const row of rows) {
      const [existing] = await db
        .select()
        .from(receiptsTable)
        .where(eq(receiptsTable.receiptNumber, String(row.receiptNumber)))
        .limit(1);

      const values = {
        receiptNumber: String(row.receiptNumber),
        clientId: Number(row.clientId) || 1,
        invoiceId: row.invoiceId ? Number(row.invoiceId) : null,
        amount: String(row.amount ?? "0"),
        paymentMethod: row.paymentMethod ?? "cash",
        notes: row.notes ?? null,
        receiptDate: row.receiptDate
          ? String(row.receiptDate)
          : new Date().toISOString().slice(0, 10),
        deletedAt: null,
      };

      if (existing) {
        await db
          .update(receiptsTable)
          .set(values)
          .where(eq(receiptsTable.id, existing.id));

        updated++;
      } else {
        await db.insert(receiptsTable).values(values);
        inserted++;
      }
    }

    return res.json({ ok: true, inserted, updated });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Import failed" });
  }
});

export default router;
