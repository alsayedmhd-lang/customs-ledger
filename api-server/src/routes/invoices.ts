import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  invoicesTable,
  invoiceItemsTable,
  clientsTable,
  usersTable,
  invoiceAuditLogsTableSqlite,
} from "@workspace/db/schema";
import { eq, desc, isNull, and, like } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";

const router: IRouter = Router();

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
        .innerJoin(usersTable, eq(invoicesTable.createdBy, usersTable.id))
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
            createdBy: createdBy ? Number(createdBy) : req.user!.userId,
          })
          .returning();
        invoice = inserted;
          
      await db.insert(invoiceAuditLogsTableSqlite).values({
        invoiceId: inserted.id,
        action: "created",
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
    const items = await db
      .select()
      .from(invoiceItemsTable)
      .where(eq(invoiceItemsTable.invoiceId, id));

    res.json({
      ...formatInvoice(
        {
          ...row.invoices,
          createdByName: row.users?.displayName || row.users?.username || null,
        },
        row.clients.name
      ),
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
    const effectiveAdvancePayment =
      status === "paid" ? 0 : parseFloat(advancePayment ?? "0") || 0;

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
    const total = subtotal + taxAmount - effectiveAdvancePayment;

    const updateData: any = {
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

    const changes: any = {
      before: {
        invoice: oldInvoice,
        items: oldItems,
      },
      after: {
        invoice,
        items: insertedItems,
      },
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

      const values = {
        shipmentRef: shipmentBase ? String(row.shipmentRef) : null,
        invoiceNumber: String(row.invoiceNumber),
        clientId: safeClientId,
        issueDate: row.issueDate ? String(row.issueDate) : new Date().toISOString().slice(0, 10),
        dueDate: row.dueDate ? String(row.dueDate) : null,
        subtotal: Number(row.subtotal ?? 0),
        taxRate: Number(row.taxRate ?? 0),
        taxAmount: Number(row.taxAmount ?? 0),
        total: Number(row.total ?? 0),
        advancePayment: Number(row.advancePayment ?? 0),
        notes: row.notes ? String(row.notes) : null,
        createdBy: row.createdBy ?? req.user?.userId ?? null,
        deletedAt: null,
        updatedAt: new Date(),
      };

      console.log("BEFORE BRANCH DECISION");

      let invoiceId: number;

      if (existing && shipmentBase) {
        console.log("IMPORT/UPDATE BRANCH", existing?.id);
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
