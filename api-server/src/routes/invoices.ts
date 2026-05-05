import { Router, type IRouter } from "express";

import {
  db,
  invoicesTable,
  invoiceItemsTable,
  clientsTable,
  usersTable,
  sqlite,
  receiptsTable,
  customerLedgerTableSqlite,
} from "@workspace/db";
import { invoiceAuditLogsTableSqlite } from "../../../lib/db/src/schema/invoices-sqlite";
import { eq, desc, isNull, and, like, isNotNull } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";

const router: IRouter = Router();

async function getClientScope(req: any) {
  if (req.user?.role !== "client") return null;
  const [user] = await db
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

const invoiceDescriptionAr = (invoiceNumber: string) =>
  `\u0641\u0627\u062a\u0648\u0631\u0629 \u0631\u0642\u0645 ${invoiceNumber}`;
const advancePaymentDescriptionAr = (invoiceNumber: string) =>
  `\u062f\u0641\u0639\u0629 \u0645\u0642\u062f\u0645\u0629 \u0639\u0644\u0649 \u0641\u0627\u062a\u0648\u0631\u0629 \u0631\u0642\u0645 ${invoiceNumber}`;
const directClosingPaymentDescriptionAr =
  "\u0633\u062f\u0627\u062f \u0646\u0642\u062f\u064a \u0645\u0628\u0627\u0634\u0631 \u0639\u0646\u062f \u0625\u063a\u0644\u0627\u0642 \u0627\u0644\u0641\u0627\u062a\u0648\u0631\u0629";
const directClosingPaymentDescriptionEn =
  "Direct cash payment on invoice closing";

try {
  sqlite?.exec("DROP INDEX IF EXISTS receipts_invoice_id_unique_active;");
} catch {}

async function getActiveReceiptTotal(invoiceId: number): Promise<number> {
  const receipts = await db
    .select({ amount: receiptsTable.amount })
    .from(receiptsTable)
    .where(and(eq(receiptsTable.invoiceId, invoiceId), isNull(receiptsTable.deletedAt)));

  return receipts.reduce((sum, receipt) => sum + Number(receipt.amount ?? 0), 0);
}

async function getExistingAutoClosingReceipt(invoiceId: number) {
  const receipts = await db
    .select({
      id: receiptsTable.id,
      amount: receiptsTable.amount,
      notes: receiptsTable.notes,
    })
    .from(receiptsTable)
    .where(and(eq(receiptsTable.invoiceId, invoiceId), isNull(receiptsTable.deletedAt)));

  return receipts.find((receipt) => {
    const notes = String(receipt.notes ?? "");
    return (
      notes.includes(directClosingPaymentDescriptionEn) ||
      notes.includes(directClosingPaymentDescriptionAr)
    );
  });
}

function resolveInvoiceStatus(
  requestedStatus: string | undefined,
  paidAmount: number,
  invoiceTotal: number
) {
  if (requestedStatus === "cancelled") return "cancelled";
  if (paidAmount >= invoiceTotal) return "paid";
  return requestedStatus === "paid" ? "issued" : requestedStatus ?? "draft";
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

function floorCurrency(value: number) {
  return Math.floor((value + 0.000001) * 100) / 100;
}

async function generateInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;

  // Use MAX of existing invoice numbers for this year to avoid race conditions
    const [row] = await db
      .select({ maxNum: invoicesTable.invoiceNumber })
      .from(invoicesTable)
      .where(like(invoicesTable.invoiceNumber, `${prefix}%`))
      .orderBy(desc(invoicesTable.invoiceNumber))
      .limit(1);

  let nextSeq = 1;
  if (row?.maxNum) {
    const parts = row.maxNum.split("-");
    const lastSeq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastSeq)) nextSeq = lastSeq + 1;
  }

  return `${prefix}${String(nextSeq).padStart(4, "0")}`;
}

async function generateReceiptNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await db.$count(receiptsTable);
  const seq = String(count + 1).padStart(4, "0");
  return `RCP-${year}-${seq}`;
}

async function createDirectClosingReceipt(input: {
  clientId: number;
  invoiceId: number;
  amount: number;
  receiptDate: string;
  createdBy: number | null;
}) {
  const receiptNumber = await generateReceiptNumber();
  const [receipt] = await db
    .insert(receiptsTable)
    .values({
      receiptNumber,
      clientId: input.clientId,
      invoiceId: input.invoiceId,
      amount: input.amount.toFixed(2),
      paymentMethod: "cash",
      notes: directClosingPaymentDescriptionEn,
      receiptDate: input.receiptDate,
      createdBy: input.createdBy,
    })
    .returning();

  await db.insert(customerLedgerTableSqlite).values({
    clientId: receipt.clientId,
    invoiceId: receipt.invoiceId ?? null,
    receiptId: receipt.id,

    entryDate: receipt.receiptDate,
    entryType: "receipt",

    descriptionAr: directClosingPaymentDescriptionAr,
    descriptionEn: directClosingPaymentDescriptionEn,

    referenceType: "receipt",
    referenceNumber: receipt.receiptNumber,

    debit: 0,
    credit: Number(receipt.amount ?? 0),

    balanceImpact: -Number(receipt.amount ?? 0),

    createdBy: input.createdBy,
  });

  return receipt;
}

router.get("/invoices", requireAuth, async (req, res) => {
  try {
    const clientScope = await getClientScope(req);
    if (clientScope && (!clientScope.clientId || clientScope.permissions?.canViewInvoices === false)) {
      return res.status(403).json({ error: "Invoices are not allowed for this client user" });
    }
    const clientId = clientScope?.clientId ?? (req.query.clientId ? parseInt(req.query.clientId as string) : null);
    const isAdmin = req.user!.role === "admin" || req.user!.role === "supervisor" || req.user!.role === "client";
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
        .innerJoin(usersTable, eq(invoicesTable.createdBy, usersTable.id))
        .where(and(...filters))
        .orderBy(desc(invoicesTable.id));
    } else {
      const filters = [isNull(invoicesTable.deletedAt)];
      if (ownerFilter) filters.push(ownerFilter);
      rows = await db
        .select()
        .from(invoicesTable)
        .innerJoin(clientsTable, eq(invoicesTable.clientId, clientsTable.id))
        .where(and(...filters))
        .orderBy(desc(invoicesTable.id));
    }

    const invoicesWithItems = await Promise.all(
      rows.map(async (row) => {
        const items = await db
          .select()
          .from(invoiceItemsTable)
          .where(eq(invoiceItemsTable.invoiceId, row.invoices.id));
        return {
          ...formatInvoice(
            {
              ...row.invoices,
              createdByName: row.users?.displayNameEn || row.users?.displayNameAr || null,
            },
            row.clients.name
          ),
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
    if (rejectClientWrite(req, res)) return;
    const {
      clientId,
      createdBy,
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

    const shipmentBase = getShipmentBase(shipmentRef);

    if (shipmentBase && shipmentBase.length >= 14) {
      const allInvoices = await db.select().from(invoicesTable);

      const existing = allInvoices.find(
        (inv: any) => getShipmentBase(inv.shipmentRef) === shipmentBase
      );

      if (existing) {
        res.status(400).json({ error: "تم عمل فاتورة لهذا البيان" });
        return;
      }
    }

    const parsedTaxRate = parseFloat(taxRate ?? "0") || 0;
    const parsedAdvancePayment = parseFloat(advancePayment ?? "0") || 0;
    const subtotal = items.reduce((sum: number, item: { quantity: number; unitPrice: number }) => {
      return sum + parseFloat(String(item.quantity)) * parseFloat(String(item.unitPrice));
    }, 0);
    const taxAmount = subtotal * (parsedTaxRate / 100);
    const total = Number((subtotal + taxAmount).toFixed(2));
    const resolvedStatus = resolveInvoiceStatus(status, parsedAdvancePayment, total);

    const deletedInvoiceWithSameShipment = shipmentRef
      ? await db
          .select()
          .from(invoicesTable)
          .where(
            and(
              eq(invoicesTable.shipmentRef, shipmentRef),
              isNotNull(invoicesTable.deletedAt)
            )
          )
          .limit(1)
      : [];

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
            status: resolvedStatus,
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
            createdBy: createdBy ? Number(createdBy) : req.user!.userId,
          })
          .returning();
        invoice = inserted;
        const invoiceLedgerDebit = getOriginalInvoiceTotal(inserted);

        await db.insert(customerLedgerTableSqlite).values({
          clientId: inserted.clientId,
          invoiceId: inserted.id,
          receiptId: null,

          entryDate: new Date().toISOString().split("T")[0],
          entryType: "invoice",

          descriptionAr: invoiceDescriptionAr(inserted.invoiceNumber),
          descriptionEn: `Invoice ${inserted.invoiceNumber}`,

          referenceType: "invoice",
          referenceNumber: inserted.invoiceNumber,

          debit: invoiceLedgerDebit,
          credit: 0,

          balanceImpact: invoiceLedgerDebit,

          createdBy: req.user?.userId ?? null,
        });

        if (Number(inserted.advancePayment ?? 0) > 0) {
          await db.insert(customerLedgerTableSqlite).values({
            clientId: inserted.clientId,
            invoiceId: inserted.id,
            receiptId: null,

            entryDate: new Date().toISOString().split("T")[0],
            entryType: "advance_payment",

            descriptionAr: advancePaymentDescriptionAr(inserted.invoiceNumber),
            descriptionEn: `Advance payment for invoice ${inserted.invoiceNumber}`,

            referenceType: "invoice",
            referenceNumber: inserted.invoiceNumber,

            debit: 0,
            credit: Number(inserted.advancePayment ?? 0),

            balanceImpact: -Number(inserted.advancePayment ?? 0),

            createdBy: req.user?.userId ?? null,
          });
        }
                  
      await db.insert(invoiceAuditLogsTableSqlite).values({
        invoiceId: inserted.id,
        action:
          Array.isArray(deletedInvoiceWithSameShipment) &&
          deletedInvoiceWithSameShipment.length > 0
            ? "recreated"
            : "created",
        userId: req.user?.userId ?? null,
        username: req.user?.username ?? null,
        userEmail: req.user?.email ?? null,
        userPhone: req.user?.phone ?? null,
        changesJson: JSON.stringify({ created: true }),
        createdAt: new Date(),
      });

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
      .leftJoin(usersTable, eq(invoicesTable.createdBy, usersTable.id))
      .where(and(eq(invoicesTable.id, id), isNull(invoicesTable.deletedAt)));

    if (!rows.length) {
      res.status(404).json({ error: "Invoice not found" });
      return;
    }

    const row = rows[0];
    const clientScope = await getClientScope(req);
    if (clientScope && (!clientScope.clientId || row.invoices.clientId !== clientScope.clientId || clientScope.permissions?.canViewInvoices === false)) {
      return res.status(403).json({ error: "Invoice is not allowed for this client user" });
    }
    const items = await db
      .select()
      .from(invoiceItemsTable)
      .where(eq(invoiceItemsTable.invoiceId, id));

    const formatted = formatInvoice(
        {
          ...row.invoices,
          createdByName: row.users?.displayName || row.users?.username || null,
        },
        row.clients.name
      );

      res.json({
        ...formatted,
        clientName: row.clients.name,
        invoiceNumber: row.invoices.invoiceNumber,
        items: items.map(formatItem),
      });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/invoices/:id/audit-logs", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (req.user?.role === "client") {
      return res.status(403).json({ error: "Audit logs are not allowed for client users" });
    }

    const logs = await db
      .select()
      .from(invoiceAuditLogsTableSqlite)
      .where(eq(invoiceAuditLogsTableSqlite.invoiceId, id))
      .orderBy(desc(invoiceAuditLogsTableSqlite.createdAt));

    res.json(logs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/invoices/:id", async (req, res) => {
  try {
    if (rejectClientWrite(req, res)) return;
    const id = parseInt(req.params.id);

    const [beforeInvoice] = await db
      .select()
      .from(invoicesTable)
      .where(eq(invoicesTable.id, id));

    if (!beforeInvoice) {
      res.status(404).json({ error: "Invoice not found" });
      return;
    }

    const beforeItems = await db
      .select()
      .from(invoiceItemsTable)
      .where(eq(invoiceItemsTable.invoiceId, id));

    const {
      clientId,
      createdBy,
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



    const [client] = await db
      .select()
      .from(clientsTable)
      .where(eq(clientsTable.id, clientId));

    if (!client) {
      res.status(400).json({ error: "Client not found" });
      return;
    }

    const shipmentBase = getShipmentBase(shipmentRef);

    if (shipmentBase && shipmentBase.length >= 14) {
      const allInvoices = await db.select().from(invoicesTable);

      const existing = allInvoices.find(
        (inv: any) =>
          getShipmentBase(inv.shipmentRef) === shipmentBase &&
          String(inv.id) !== String(id)
      );

      if (existing) {
        res.status(400).json({ error: "تم عمل فاتورة لهذا البيان" });
        return;
      }
    }

    const parsedTaxRate = parseFloat(taxRate ?? "0") || 0;
    const effectiveAdvancePayment = parseFloat(advancePayment ?? "0") || 0;

    const subtotal = (items ?? []).reduce(
      (sum: number, item: { quantity: number; unitPrice: number }) => {
        return (
          sum +
          parseFloat(String(item.quantity)) *
            parseFloat(String(item.unitPrice))
        );
      },
      0
    );

    const taxAmount = subtotal * (parsedTaxRate / 100);
    const total = Number((subtotal + taxAmount).toFixed(2));
    let receiptTotal = await getActiveReceiptTotal(id);
    const requestedPaid = status === "paid";
    const remaining = total - (effectiveAdvancePayment + receiptTotal);

    if (requestedPaid && remaining > 0.000001) {
      const existingAutoReceipt = await getExistingAutoClosingReceipt(id);

      if (!existingAutoReceipt) {
        const createdByUser =
          typeof createdBy !== "undefined" &&
          createdBy !== null &&
          createdBy !== "" &&
          !Number.isNaN(Number(createdBy))
            ? Number(createdBy)
            : req.user?.userId ?? null;
        const safeRemaining = Math.max(
          total - (effectiveAdvancePayment + receiptTotal),
          0
        );
        const receiptAmount = floorCurrency(safeRemaining);

        if (receiptAmount > 0) {
          await createDirectClosingReceipt({
            clientId,
            invoiceId: id,
            amount: receiptAmount,
            receiptDate: new Date().toISOString().split("T")[0],
            createdBy: createdByUser,
          });

          receiptTotal += receiptAmount;
        }
      }
    }

    const resolvedStatus = resolveInvoiceStatus(
      status,
      effectiveAdvancePayment + receiptTotal,
      total
    );

    const updateData: any = {
      clientId,
      issueDate,
      dueDate: dueDate ?? null,
      status: resolvedStatus,
      subtotal: subtotal.toFixed(2),
      taxRate: parsedTaxRate.toFixed(2),
      taxAmount: taxAmount.toFixed(2),
      advancePayment: effectiveAdvancePayment.toFixed(2),
      total: total.toFixed(2),
      notes: notes ?? null,
      shipmentRef: shipmentRef ?? null,
      billOfLading: billOfLading ?? null,
      packageCount: packageCount ? parseInt(packageCount) : null,
      shipmentWeight: shipmentWeight
        ? parseFloat(shipmentWeight).toFixed(3)
        : null,
      portOfEntry: portOfEntry ?? null,
      importerExporterName: importerExporterName ?? null,
      updatedAt: new Date(),
    };

    if (
      typeof createdBy !== "undefined" &&
      createdBy !== null &&
      createdBy !== "" &&
      !Number.isNaN(Number(createdBy))
    ) {
      updateData.createdBy = Number(createdBy);
    }

    const [oldInvoice] = await db
      .select()
      .from(invoicesTable)
      .where(eq(invoicesTable.id, id));

    const oldItems = await db
      .select()
      .from(invoiceItemsTable)
      .where(eq(invoiceItemsTable.invoiceId, id));

    const [invoice] = await db
      .update(invoicesTable)
      .set(updateData)
      .where(and(eq(invoicesTable.id, id), isNull(invoicesTable.deletedAt)))
      .returning();

    if (!invoice) {
      res.status(404).json({ error: "Invoice not found" });
      return;
    }

    await db
      .delete(invoiceItemsTable)
      .where(eq(invoiceItemsTable.invoiceId, id));

    const insertedItems = await Promise.all(
      (items ?? []).map(
        async (item: {
          description: string;
          quantity: number;
          unitPrice: number;
        }) => {
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
        }
      )
    );

    const normalizeAuditItem = (item: any) => ({
  description: String(item.description ?? "").trim(),
  quantity: Number(item.quantity ?? 0),
  unitPrice: Number(item.unitPrice ?? 0),
  total: Number(item.total ?? 0),
});

const oldAuditItems = beforeItems.map(normalizeAuditItem);
const newAuditItems = insertedItems.map(normalizeAuditItem);

const itemAuditChanges: string[] = [];

const maxItemsLength = Math.max(oldAuditItems.length, newAuditItems.length);

for (let i = 0; i < maxItemsLength; i++) {
  const before = oldAuditItems[i];
  const after = newAuditItems[i];

  if (!before && after) {
    itemAuditChanges.push(`تمت إضافة صنف: ${after.description}`);
    continue;
  }

  if (before && !after) {
    itemAuditChanges.push(`تم حذف صنف: ${before.description}`);
    continue;
  }

  if (!before || !after) continue;

  if (before.description !== after.description) {
    itemAuditChanges.push(`تم تغيير وصف الصنف من "${before.description}" إلى "${after.description}"`);
  }

  if (before.quantity !== after.quantity) {
    itemAuditChanges.push(`تم تغيير كمية الصنف "${after.description}" من ${before.quantity} إلى ${after.quantity}`);
  }

  if (before.unitPrice !== after.unitPrice) {
    itemAuditChanges.push(`تم تغيير سعر الصنف "${after.description}" من ${before.unitPrice} إلى ${after.unitPrice}`);
  }

  if (before.total !== after.total) {
    itemAuditChanges.push(`تم تغيير إجمالي الصنف "${after.description}" من ${before.total} إلى ${after.total}`);
  }
}

    const changes: any = {
      before: {
        invoice: oldInvoice,
        items: oldItems,
      },
      after: {
        invoice,
        items: insertedItems,
      },
      itemChanges: itemAuditChanges,
    };

    await db.insert(invoiceAuditLogsTableSqlite).values({
      invoiceId: invoice.id,
      action: "updated",
      userId: req.user?.userId ?? null,
      username: req.user?.username ?? null,
      userEmail: req.user?.email ?? null,
      userPhone: req.user?.phone ?? null,
      changesJson: JSON.stringify(changes),
      createdAt: new Date(),
    });

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
    if (rejectClientWrite(req, res)) return;
    const id = parseInt(req.params.id);
     const [oldInvoice] = await db
      .select()
      .from(invoicesTable)
      .where(eq(invoicesTable.id, id)); 
    await db
      .update(invoicesTable)
      .set({ deletedAt: new Date() })
      .where(and(eq(invoicesTable.id, id), isNull(invoicesTable.deletedAt)));

    await db.insert(invoiceAuditLogsTableSqlite).values({
        invoiceId: id,
        action: "deleted",
        userId: req.user?.userId ?? null,
        username: req.user?.username ?? null,
        userEmail: req.user?.email ?? null,
        userPhone: req.user?.phone ?? null,
        changesJson: JSON.stringify({
          before: oldInvoice,
          after: { deletedAt: new Date() },
        }),
        createdAt: new Date(),
      });

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
    subtotal: Number(inv.subtotal ?? 0),
    taxRate: Number(inv.taxRate ?? 0),
    taxAmount: Number(inv.taxAmount ?? 0),
    total: Number(inv.total ?? 0),
    advancePayment: Number(inv.advancePayment ?? 0),
    notes: inv.notes ?? null,
    shipmentRef: inv.shipmentRef ?? null,
    billOfLading: inv.billOfLading ?? null,
    packageCount: inv.packageCount ?? null,
    shipmentWeight: inv.shipmentWeight ? Number(inv.shipmentWeight) : null,
    portOfEntry: inv.portOfEntry ?? null,
    importerExporterName: inv.importerExporterName ?? null,
    createdBy: inv.createdBy ?? null,
    createdByName: (inv as any).createdByName ?? null,
    deletedAt: inv.deletedAt ? inv.deletedAt.toISOString() : null,
    createdAt: inv.createdAt ? inv.createdAt.toISOString() : null,
    updatedAt: inv.updatedAt ? inv.updatedAt.toISOString() : null,
  };
}

export function formatItem(item: typeof invoiceItemsTable.$inferSelect) {
  return {
    id: item.id,
    invoiceId: item.invoiceId,
    description: item.description,
    quantity: Number(item.quantity ?? 0),
    unitPrice: Number(item.unitPrice ?? 0),
    total: Number(item.total ?? 0),
  };
}

function getShipmentBase(value: unknown) {
  return String(value ?? "").trim().slice(0, 14);
}

router.post("/invoices/import", requireAuth, async (req, res) => {
  try {
    if (rejectClientWrite(req, res)) return;
    const rows = req.body.data;

    if (!Array.isArray(rows)) {
      return res.status(400).json({ error: "Invalid data" });
    }

    let inserted = 0;
    let updated = 0;

    for (const row of rows) {

      const shipmentBase =
        row.shipmentRef && getShipmentBase(row.shipmentRef).length >= 14
          ? getShipmentBase(row.shipmentRef)
          : null;
      const [existing] = await db
        .select()
        .from(invoicesTable)
        .where(
          shipmentBase
            ? eq(invoicesTable.shipmentRef, shipmentBase)
            : eq(invoicesTable.invoiceNumber, "__never_match__")
        )
        .limit(1);
      const requestedClientId = Number(row.clientId);

      const [clientExists] = await db
        .select()
        .from(clientsTable)
        .where(eq(clientsTable.id, requestedClientId))
        .limit(1);

      const safeClientId = clientExists ? requestedClientId : 1;

      let finalInvoiceNumber = String(row.invoiceNumber);

      const [sameInvoiceNumber] = await db
        .select()
        .from(invoicesTable)
        .where(eq(invoicesTable.invoiceNumber, finalInvoiceNumber))
        .limit(1);

      if (
        sameInvoiceNumber &&
        (!shipmentBase || sameInvoiceNumber.shipmentRef !== shipmentBase)
      ) {
        const baseInvoice = String(row.invoiceNumber).replace(/-\d+$/, "");
        let counter = 1;

        while (true) {
          const candidate = `${baseInvoice}-${counter}`;

          const [existsCandidate] = await db
            .select()
            .from(invoicesTable)
            .where(eq(invoicesTable.invoiceNumber, candidate))
            .limit(1);

          if (!existsCandidate) {
            finalInvoiceNumber = candidate;
            break;
          }

          counter++;
        }
      }

      const values = {
        shipmentRef: shipmentBase,
        invoiceNumber: finalInvoiceNumber,
        clientId: safeClientId,
        issueDate: row.issueDate ? String(row.issueDate) : new Date().toISOString().slice(0, 10),
        dueDate: row.dueDate ? String(row.dueDate) : null,
        subtotal: Number(row.subtotal ?? 0),
        taxRate: Number(row.taxRate ?? 0),
        taxAmount: Number(row.taxAmount ?? 0),
        total:
          Number(row.subtotal ?? 0) + Number(row.taxAmount ?? 0) > 0
            ? Number(row.subtotal ?? 0) + Number(row.taxAmount ?? 0)
            : Number(row.total ?? 0),
        advancePayment: Number(row.advancePayment ?? 0),
        notes: row.notes ? String(row.notes) : null,
        createdBy: row.createdBy ?? req.user?.userId ?? null,
        deletedAt: null,
        updatedAt: new Date(),
      };

      let invoiceId: number;

      if (existing && shipmentBase) {
      
        await db
          .update(invoicesTable)
          .set(values)
          .where(eq(invoicesTable.id, existing.id));

        invoiceId = existing.id;

        await db
          .delete(invoiceItemsTable)
          .where(eq(invoiceItemsTable.invoiceId, invoiceId));

        updated++;
      } else {
        const [created] = await db
          .insert(invoicesTable)
          .values({
            ...values,
            createdAt: new Date(),
          })
          .returning();

        invoiceId = created.id;

          const invoiceAmount = getOriginalInvoiceTotal(values);

          await db.insert(customerLedgerTableSqlite).values({
            clientId: values.clientId,

            invoiceId: created.id,
            receiptId: null,

            entryDate: new Date().toISOString().split("T")[0],

            entryType: "invoice",

            descriptionAr: invoiceDescriptionAr(created.invoiceNumber),
            descriptionEn: `Invoice ${created.invoiceNumber}`,

            referenceType: "invoice",
            referenceNumber: created.invoiceNumber,

            debit: invoiceAmount,
            credit: 0,

            balanceImpact: invoiceAmount,

            createdBy: null,
          });

          if (Number(values.advancePayment ?? 0) > 0) {
            await db.insert(customerLedgerTableSqlite).values({
              clientId: values.clientId,
              invoiceId: created.id,
              receiptId: null,

              entryDate: new Date().toISOString().split("T")[0],
              entryType: "advance_payment",

              descriptionAr: advancePaymentDescriptionAr(created.invoiceNumber),
              descriptionEn: `Advance payment for invoice ${created.invoiceNumber}`,

              referenceType: "invoice",
              referenceNumber: created.invoiceNumber,

              debit: 0,
              credit: Number(values.advancePayment ?? 0),

              balanceImpact: -Number(values.advancePayment ?? 0),

              createdBy: null,
            });
          }

        inserted++;
      }

      if (Array.isArray(row.items) && row.items.length > 0) {
        await db.insert(invoiceItemsTable).values(
          row.items.map((item: any) => ({
            invoiceId,
            description: String(item.description ?? ""),
            quantity: Number(item.quantity ?? 0),
            unitPrice: Number(item.unitPrice ?? 0),
            total: Number(
              item.total ??
              Number(item.quantity ?? 0) * Number(item.unitPrice ?? 0)
            ),
          }))
        );
      }
    }

    return res.json({ ok: true, inserted, updated });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Import failed" });
  }
});
export default router;
