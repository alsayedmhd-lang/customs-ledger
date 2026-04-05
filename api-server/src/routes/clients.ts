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
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
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
    subtotal: parseFloat(inv.subtotal ?? "0"),
    taxRate: parseFloat(inv.taxRate ?? "0"),
    taxAmount: parseFloat(inv.taxAmount ?? "0"),
    advancePayment: parseFloat((inv as any).advancePayment ?? "0"),
    total: parseFloat(inv.total ?? "0"),
    notes: inv.notes ?? null,
    shipmentRef: inv.shipmentRef ?? null,
    portOfEntry: inv.portOfEntry ?? null,
    createdAt: inv.createdAt.toISOString(),
    updatedAt: inv.updatedAt.toISOString(),
  };
}

function formatItem(item: typeof invoiceItemsTable.$inferSelect) {
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
