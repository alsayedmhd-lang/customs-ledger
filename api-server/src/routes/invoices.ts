import { Router, type IRouter } from "express";
import { db, invoicesTable, invoiceItemsTable, clientsTable } from "@workspace/db";
import { eq, desc, isNull, and, like, max } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";

const router: IRouter = Router();

async function generateInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;

  // Use MAX of existing invoice numbers for this year to avoid race conditions
  const [row] = await db
    .select({ maxNum: max(invoicesTable.invoiceNumber) })
    .from(invoicesTable)
    .where(like(invoicesTable.invoiceNumber, `${prefix}%`));

  let nextSeq = 1;
  if (row?.maxNum) {
    const parts = row.maxNum.split("-");
    const lastSeq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastSeq)) nextSeq = lastSeq + 1;
  }

  return `${prefix}${String(nextSeq).padStart(4, "0")}`;
}

router.get("/invoices", requireAuth, async (req, res) => {
  try {
    const clientId = req.query.clientId ? parseInt(req.query.clientId as string) : null;
    const isAdmin = req.user!.role === "admin" || req.user!.role === "supervisor";
    const userId = req.user!.userId;

    // Non-admins/supervisors only see their own invoices
    const ownerFilter = isAdmin ? null : eq(invoicesTable.createdBy, userId);

    let rows;
    if (clientId) {
      const filters = [eq(invoicesTable.clientId, clientId), isNull(invoicesTable.deletedAt)];
      if (ownerFilter) filters.push(ownerFilter);
      rows = await db
        .select()
        .from(invoicesTable)
        .innerJoin(clientsTable, eq(invoicesTable.clientId, clientsTable.id))
        .where(and(...filters))
        .orderBy(desc(invoicesTable.createdAt));
    } else {
      const filters = [isNull(invoicesTable.deletedAt)];
      if (ownerFilter) filters.push(ownerFilter);
      rows = await db
        .select()
        .from(invoicesTable)
        .innerJoin(clientsTable, eq(invoicesTable.clientId, clientsTable.id))
        .where(and(...filters))
        .orderBy(desc(invoicesTable.createdAt));
    }

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

router.post("/invoices", requireAuth, async (req, res) => {
  try {
    const {
      clientId,
      issueDate,
      dueDate,
      status,
      taxRate,
      advancePayment,
      notes,
      shipmentRef,
      billOfLading,
      packageCount,
      shipmentWeight,
      portOfEntry,
      importerExporterName,
      items,
    } = req.body;

    if (!clientId || !issueDate || !items || !Array.isArray(items)) {
      res.status(400).json({ error: "clientId, issueDate, and items are required" });
      return;
    }

    const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, clientId));
    if (!client) {
      res.status(400).json({ error: "Client not found" });
      return;
    }

    const parsedTaxRate = parseFloat(taxRate ?? "0") || 0;
    const parsedAdvancePayment = parseFloat(advancePayment ?? "0") || 0;
    const subtotal = items.reduce((sum: number, item: { quantity: number; unitPrice: number }) => {
      return sum + parseFloat(String(item.quantity)) * parseFloat(String(item.unitPrice));
    }, 0);
    const taxAmount = subtotal * (parsedTaxRate / 100);
    const total = subtotal + taxAmount - parsedAdvancePayment;

    // Retry up to 5 times if invoice number collides (race condition)
    let invoice: typeof invoicesTable.$inferSelect | null = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const invoiceNumber = await generateInvoiceNumber();
      try {
        const [inserted] = await db
          .insert(invoicesTable)
          .values({
            invoiceNumber,
            clientId,
            issueDate,
            dueDate: dueDate ?? null,
            status: status ?? "draft",
            subtotal: subtotal.toFixed(2),
            taxRate: parsedTaxRate.toFixed(2),
            taxAmount: taxAmount.toFixed(2),
            advancePayment: parsedAdvancePayment.toFixed(2),
            total: total.toFixed(2),
            notes: notes ?? null,
            shipmentRef: shipmentRef ?? null,
            billOfLading: billOfLading ?? null,
            packageCount: packageCount ? parseInt(packageCount) : null,
            shipmentWeight: shipmentWeight ? parseFloat(shipmentWeight).toFixed(3) : null,
            portOfEntry: portOfEntry ?? null,
            importerExporterName: importerExporterName ?? null,
            createdBy: req.user!.userId,
          })
          .returning();
        invoice = inserted;
        break;
      } catch (insertErr: any) {
        // 23505 = unique_violation in PostgreSQL
        if (insertErr?.cause?.code === "23505" || insertErr?.code === "23505") {
          continue;
        }
        throw insertErr;
      }
    }

    if (!invoice) {
      res.status(500).json({ error: "تعذر إنشاء رقم فاتورة فريد. حاول مرة أخرى." });
      return;
    }

    const insertedItems = await Promise.all(
      items.map(async (item: { description: string; quantity: number; unitPrice: number }) => {
        const qty = parseFloat(String(item.quantity));
        const price = parseFloat(String(item.unitPrice));
        const itemTotal = qty * price;
        const [inserted] = await db
          .insert(invoiceItemsTable)
          .values({
            invoiceId: invoice!.id,
            description: item.description,
            quantity: qty.toFixed(3),
            unitPrice: price.toFixed(2),
            total: itemTotal.toFixed(2),
          })
          .returning();
        return formatItem(inserted);
      })
    );

    res.status(201).json({
      ...formatInvoice(invoice, client.name),
      items: insertedItems,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/invoices/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const rows = await db
      .select()
      .from(invoicesTable)
      .innerJoin(clientsTable, eq(invoicesTable.clientId, clientsTable.id))
      .where(and(eq(invoicesTable.id, id), isNull(invoicesTable.deletedAt)));

    if (!rows.length) {
      res.status(404).json({ error: "Invoice not found" });
      return;
    }

    const row = rows[0];
    const items = await db
      .select()
      .from(invoiceItemsTable)
      .where(eq(invoiceItemsTable.invoiceId, id));

    res.json({
      ...formatInvoice(row.invoices, row.clients.name),
      items: items.map(formatItem),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/invoices/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const {
      clientId,
      issueDate,
      dueDate,
      status,
      taxRate,
      advancePayment,
      notes,
      shipmentRef,
      billOfLading,
      packageCount,
      shipmentWeight,
      portOfEntry,
      importerExporterName,
      items,
    } = req.body;

    const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, clientId));
    if (!client) {
      res.status(400).json({ error: "Client not found" });
      return;
    }

    const parsedTaxRate = parseFloat(taxRate ?? "0") || 0;
    const effectiveAdvancePayment = status === "paid" ? 0 : parseFloat(advancePayment ?? "0") || 0;
    const subtotal = (items ?? []).reduce(
      (sum: number, item: { quantity: number; unitPrice: number }) => {
        return sum + parseFloat(String(item.quantity)) * parseFloat(String(item.unitPrice));
      },
      0
    );
    const taxAmount = subtotal * (parsedTaxRate / 100);
    const total = subtotal + taxAmount - effectiveAdvancePayment;

    const [invoice] = await db
      .update(invoicesTable)
      .set({
        clientId,
        issueDate,
        dueDate: dueDate ?? null,
        status: status ?? "draft",
        subtotal: subtotal.toFixed(2),
        taxRate: parsedTaxRate.toFixed(2),
        taxAmount: taxAmount.toFixed(2),
        advancePayment: effectiveAdvancePayment.toFixed(2),
        total: total.toFixed(2),
        notes: notes ?? null,
        shipmentRef: shipmentRef ?? null,
        billOfLading: billOfLading ?? null,
        packageCount: packageCount ? parseInt(packageCount) : null,
        shipmentWeight: shipmentWeight ? parseFloat(shipmentWeight).toFixed(3) : null,
        portOfEntry: portOfEntry ?? null,
        importerExporterName: importerExporterName ?? null,
        updatedAt: new Date(),
      })
      .where(and(eq(invoicesTable.id, id), isNull(invoicesTable.deletedAt)))
      .returning();

    if (!invoice) {
      res.status(404).json({ error: "Invoice not found" });
      return;
    }

    await db.delete(invoiceItemsTable).where(eq(invoiceItemsTable.invoiceId, id));

    const insertedItems = await Promise.all(
      (items ?? []).map(async (item: { description: string; quantity: number; unitPrice: number }) => {
        const qty = parseFloat(String(item.quantity));
        const price = parseFloat(String(item.unitPrice));
        const itemTotal = qty * price;
        const [inserted] = await db
          .insert(invoiceItemsTable)
          .values({
            invoiceId: invoice.id,
            description: item.description,
            quantity: qty.toFixed(3),
            unitPrice: price.toFixed(2),
            total: itemTotal.toFixed(2),
          })
          .returning();
        return formatItem(inserted);
      })
    );

    res.json({
      ...formatInvoice(invoice, client.name),
      items: insertedItems,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Soft delete invoice (move to trash)
router.delete("/invoices/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db
      .update(invoicesTable)
      .set({ deletedAt: new Date() })
      .where(and(eq(invoicesTable.id, id), isNull(invoicesTable.deletedAt)));
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export function formatInvoice(inv: typeof invoicesTable.$inferSelect, clientName: string) {
  return {
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    clientId: inv.clientId,
    clientName,
    issueDate: inv.issueDate,
    dueDate: inv.dueDate ?? null,
    status: inv.status,
    subtotal: parseFloat(inv.subtotal ?? "0"),
    taxRate: parseFloat(inv.taxRate ?? "0"),
    taxAmount: parseFloat(inv.taxAmount ?? "0"),
    total: parseFloat(inv.total ?? "0"),
    advancePayment: parseFloat(inv.advancePayment ?? "0"),
    notes: inv.notes ?? null,
    shipmentRef: inv.shipmentRef ?? null,
    billOfLading: inv.billOfLading ?? null,
    packageCount: inv.packageCount ?? null,
    shipmentWeight: inv.shipmentWeight ? parseFloat(inv.shipmentWeight) : null,
    portOfEntry: inv.portOfEntry ?? null,
    importerExporterName: inv.importerExporterName ?? null,
    createdBy: inv.createdBy ?? null,
    deletedAt: inv.deletedAt ? inv.deletedAt.toISOString() : null,
    createdAt: inv.createdAt.toISOString(),
    updatedAt: inv.updatedAt.toISOString(),
  };
}

export function formatItem(item: typeof invoiceItemsTable.$inferSelect) {
  return {
    id: item.id,
    invoiceId: item.invoiceId,
    description: item.description,
    quantity: parseFloat(item.quantity ?? "0"),
    unitPrice: parseFloat(item.unitPrice ?? "0"),
    total: parseFloat(item.total ?? "0"),
  };
}

export default router;
