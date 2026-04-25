import { Router, type IRouter } from "express";
import { db, clientsTable, invoicesTable, invoiceItemsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router: IRouter = Router();

router.get("/clients", async (_req, res) => {
  try {
    const clients = await db
      .select()
      .from(clientsTable)
      .orderBy(desc(clientsTable.createdAt));
    res.json(clients.map(formatClient));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/clients", async (req, res) => {
  try {
    const { name, email, phone, address, taxId, notes } = req.body;
    if (!name) {
      res.status(400).json({ error: "name is required" });
      return;
    }
    const [client] = await db
      .insert(clientsTable)
      .values({ name, email: email ?? null, phone: phone ?? null, address: address ?? null, taxId: taxId ?? null, notes: notes ?? null })
      .returning();
    res.status(201).json(formatClient(client));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/clients/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, id));
    if (!client) {
      res.status(404).json({ error: "Client not found" });
      return;
    }
    res.json(formatClient(client));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/clients/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, email, phone, address, taxId, notes } = req.body;
    if (!name) {
      res.status(400).json({ error: "name is required" });
      return;
    }
    const [client] = await db
      .update(clientsTable)
      .set({ name, email: email ?? null, phone: phone ?? null, address: address ?? null, taxId: taxId ?? null, notes: notes ?? null, updatedAt: new Date() })
      .where(eq(clientsTable.id, id))
      .returning();
    if (!client) {
      res.status(404).json({ error: "Client not found" });
      return;
    }
    res.json(formatClient(client));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/clients/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(clientsTable).where(eq(clientsTable.id, id));
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/clients/:id/statement", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, id));
    if (!client) {
      res.status(404).json({ error: "Client not found" });
      return;
    }
    const invoices = await db
      .select()
      .from(invoicesTable)
      .where(eq(invoicesTable.clientId, id))
      .orderBy(desc(invoicesTable.issueDate));

    const invoicesWithItems = await Promise.all(
      invoices.map(async (inv) => {
        const items = await db
          .select()
          .from(invoiceItemsTable)
          .where(eq(invoiceItemsTable.invoiceId, inv.id));
        return {
          ...formatInvoice(inv, client.name),
          items: items.map(formatItem),
        };
      })
    );

    const totalDue = invoices
      .filter((i) => i.status === "issued")
      .reduce((sum, i) => sum + parseFloat(i.total ?? "0"), 0);
    const totalPaid = invoices
      .filter((i) => i.status === "paid")
      .reduce((sum, i) => sum + parseFloat(i.total ?? "0"), 0);

    res.json({
      client: formatClient(client),
      invoices: invoicesWithItems,
      totalDue,
      totalPaid,
      balance: totalDue,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

function formatClient(c: typeof clientsTable.$inferSelect) {
  return {
    id: c.id,
    name: c.name,
    email: c.email ?? null,
    phone: c.phone ?? null,
    address: c.address ?? null,
    taxId: c.taxId ?? null,
    notes: c.notes ?? null,
    createdAt: c.createdAt ? new Date(c.createdAt).toISOString() : null,
    updatedAt: c.updatedAt ? new Date(c.updatedAt).toISOString() : null,
  };
}

function formatInvoice(inv: typeof invoicesTable.$inferSelect, clientName: string) {
  return {
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    clientId: inv.clientId,
    clientName,
    issueDate: inv.issueDate,
    dueDate: inv.dueDate ?? null,
    status: inv.status,
    subtotal: parseFloat(String(inv.subtotal ?? "0")),
    taxRate: parseFloat(String(inv.taxRate ?? "0")),
    taxAmount: parseFloat(String(inv.taxAmount ?? "0")),
    advancePayment: parseFloat(String((inv as any).advancePayment ?? "0")),
    total: parseFloat(String(inv.total ?? "0")),
    notes: inv.notes ?? null,
    shipmentRef: inv.shipmentRef ?? null,
    portOfEntry: inv.portOfEntry ?? null,
    createdAt: inv.createdAt ? inv.createdAt.toISOString() : null,
    updatedAt: inv.updatedAt ? inv.updatedAt.toISOString() : null,
  };
}

function formatItem(item: typeof invoiceItemsTable.$inferSelect) {
  return {
    id: item.id,
    invoiceId: item.invoiceId,
    description: item.description,
    quantity: parseFloat(String(item.quantity ?? "0")),
    unitPrice: parseFloat(String(item.unitPrice ?? "0")),
    total: parseFloat(String(item.total ?? "0")),
  };
}

router.post("/clients/import", async (req: any, res: any) => {
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
        .from(clientsTable)
        .where(eq(clientsTable.name, row.name))
        .limit(1);

      const values = {
        name: String(row.name),
        email: row.email ?? null,
        phone: row.phone ?? null,
        address: row.address ?? null,
        taxId: row.taxId ?? null,
        notes: row.notes ?? null,
        updatedAt: new Date(),
      };

      if (existing) {
        await db
          .update(clientsTable)
          .set(values)
          .where(eq(clientsTable.id, existing.id));

        updated++;
      } else {
        await db.insert(clientsTable).values({
          ...values,
          createdAt: new Date(),
        });

        inserted++;
      }
    }

    res.json({ ok: true, inserted, updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Import failed" });
  }
});

export default router;
