import { Router, type IRouter } from "express";
import { db, clientsTable, invoicesTable, invoiceItemsTable, usersTable, receiptsTable } from "@workspace/db";
import { and, eq, desc, gte, lte, sql, isNull } from "drizzle-orm";

const router: IRouter = Router();

async function getClientScope(req: any) {
  if (req.user?.role !== "client") return null;
  const [user] = await db
    .select({ clientId: usersTable.clientId, clientViewPermissions: usersTable.clientViewPermissions })
    .from(usersTable)
    .where(sql`${usersTable.id} = ${req.user.userId}`)
    .limit(1);
  return user?.clientId ? { clientId: Number(user.clientId), permissions: user.clientViewPermissions as any } : { clientId: null, permissions: null };
}

function rejectClientWrite(req: any, res: any) {
  if (req.user?.role !== "client") return false;
  res.status(403).json({ error: "Client users have read-only access" });
  return true;
}

function normalizeClientIdentity(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeClientPhone(value: unknown) {
  return String(value ?? "").replace(/[^\d+]/g, "").trim();
}

async function findClientByIdentity(input: {
  taxId?: unknown;
  email?: unknown;
  phone?: unknown;
  excludeId?: number;
}) {
  const taxId = normalizeClientIdentity(input.taxId);
  const email = normalizeClientIdentity(input.email);
  const phone = normalizeClientPhone(input.phone);

  const matchedClients = new Map<number, typeof clientsTable.$inferSelect>();

  if (taxId) {
    const rows = await db.select().from(clientsTable);
    for (const client of rows) {
      if (normalizeClientIdentity(client.taxId) === taxId) {
        if (client.id !== input.excludeId) {
          matchedClients.set(client.id, client);
        }
      }
    }
  }

  if (email) {
    const rows = await db.select().from(clientsTable);
    for (const client of rows) {
      if (normalizeClientIdentity(client.email) === email) {
        if (client.id !== input.excludeId) {
          matchedClients.set(client.id, client);
        }
      }
    }
  }

  if (phone) {
    const rows = await db.select().from(clientsTable);
    for (const client of rows) {
      if (normalizeClientPhone(client.phone) === phone) {
        if (client.id !== input.excludeId) {
          matchedClients.set(client.id, client);
        }
      }
    }
  }

  const matches = Array.from(matchedClients.values());

  if (matches.length > 1) {
    throw new Error(
      "CLIENT_IDENTITY_CONFLICT: tax ID, email, or phone match different clients"
    );
  }

  return matches[0] ?? null;
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

router.get("/clients", async (req, res) => {
  try {
    const clientScope = await getClientScope(req);
    if (clientScope && !clientScope.clientId) return res.status(403).json({ error: "Client is not linked" });
    const query = db
      .select()
      .from(clientsTable)
      .orderBy(sql`created_at DESC`);
    const clients = clientScope
      ? await db.select().from(clientsTable).where(sql`${clientsTable.id} = ${clientScope.clientId}`)
      : await query;
    res.json(clients.map(formatClient));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/clients", async (req, res) => {
  try {
    if (rejectClientWrite(req, res)) return;
    const { name, email, phone, address, taxId, notes } = req.body;
    if (!name) {
      res.status(400).json({ error: "name is required" });
      return;
    }
    const hasIdentity =
      normalizeClientIdentity(taxId) ||
      normalizeClientIdentity(email) ||
      normalizeClientPhone(phone);

    if (!hasIdentity) {
      return res.status(400).json({
        error: "CLIENT_IDENTITY_REQUIRED",
        message: "Phone, email, or tax ID is required",
      });
    }

      const existingClient = await findClientByIdentity({
    taxId,
    email,
    phone,
  });

  if (existingClient) {
    return res.status(409).json({
      error: "CLIENT_ALREADY_EXISTS",
      message: "A client with the same tax ID, email, or phone already exists",
      clientId: existingClient.id,
      clientName: existingClient.name,
    });
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
    const clientScope = await getClientScope(req);
    if (clientScope && clientScope.clientId !== id) return res.status(403).json({ error: "Client is not allowed" });
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
    if (rejectClientWrite(req, res)) return;
    const id = parseInt(req.params.id);
    const { name, email, phone, address, taxId, notes } = req.body;
    if (!name) {
      res.status(400).json({ error: "name is required" });
      return;
    }
    const hasIdentity =
      normalizeClientIdentity(taxId) ||
      normalizeClientIdentity(email) ||
      normalizeClientPhone(phone);

    if (!hasIdentity) {
      return res.status(400).json({
        error: "CLIENT_IDENTITY_REQUIRED",
        message: "Phone, email, or tax ID is required",
      });
    }

      const conflictingClient = await findClientByIdentity({
    taxId,
    email,
    phone,
    excludeId: id,
  });

  if (conflictingClient) {
    return res.status(409).json({
      error: "CLIENT_IDENTITY_CONFLICT",
      message: "The tax ID, email, or phone is already used by another client",
      clientId: conflictingClient.id,
      clientName: conflictingClient.name,
    });
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
    if (rejectClientWrite(req, res)) return;
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
    const clientScope = await getClientScope(req);
    if (clientScope && (clientScope.clientId !== id || clientScope.permissions?.canViewStatement === false)) {
      return res.status(403).json({ error: "Statement is not allowed for this client user" });
    }
    const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, id));
    if (!client) {
      res.status(404).json({ error: "Client not found" });
      return;
    }
    const fromDate = typeof req.query.from === "string" ? req.query.from : "";
    const toDate = typeof req.query.to === "string" ? req.query.to : "";

    const invoiceConditions = [
      sql`${invoicesTable.clientId} = ${id}`,
    ];

    if (fromDate) {
      invoiceConditions.push(sql`${invoicesTable.issueDate} >= ${fromDate}`);
    }

    if (toDate) {
      invoiceConditions.push(sql`${invoicesTable.issueDate} <= ${toDate}`);
    }

    const invoices = await db
      .select()
      .from(invoicesTable)
      .where(and(...invoiceConditions))
      .orderBy(sql`${invoicesTable.issueDate} desc`);

    const receiptConditions = [
      sql`${receiptsTable.clientId} = ${id}`,
      sql`${receiptsTable.status} = ${"issued"}`,
      isNull(receiptsTable.deletedAt),
    ];

    if (fromDate) {
      receiptConditions.push(sql`${receiptsTable.receiptDate} >= ${fromDate}`);
    }

    if (toDate) {
      receiptConditions.push(sql`${receiptsTable.receiptDate} <= ${toDate}`);
    }

    const issuedReceipts = await db
      .select()
      .from(receiptsTable)
      .where(and(...receiptConditions));

    const invoicesWithItems = await Promise.all(
      invoices.map(async (inv) => {
        const items = await db
          .select()
          .from(invoiceItemsTable)
          .where(sql`${invoiceItemsTable.invoiceId} = ${inv.id}`);
        return {
          ...formatInvoice(inv, client.name),
          items: items.map(formatItem),
        };
      })
    );

    const totalDue = invoices
      .filter((i) => i.status !== "cancelled")
      .reduce((sum, i) => sum + getOriginalInvoiceTotal(i), 0);
    const filteredInvoiceIds = new Set(invoices.map((inv) => Number(inv.id)));
    const filteredIssuedReceipts = issuedReceipts.filter((receipt) =>
      !receipt.invoiceId || filteredInvoiceIds.has(Number(receipt.invoiceId))
    );

    const totalPaid =
      invoices.reduce((sum, i) => sum + Number((i as any).advancePayment ?? 0), 0) +
      filteredIssuedReceipts.reduce((sum, r) => sum + Number(r.amount ?? 0), 0);

    res.json({
      client: formatClient(client),
      invoices: invoicesWithItems,
      totalDue,
      totalPaid,
      balance: totalDue - totalPaid,
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
    if (rejectClientWrite(req, res)) return;
    const rows = req.body.data;

    if (!Array.isArray(rows)) {
      return res.status(400).json({ error: "Invalid data" });
    }

    let inserted = 0;
    let updated = 0;
    const clientIdMap: Record<string, number> = {};

    for (const row of rows) {
      const existing = await findClientByIdentity({
          taxId: row.taxId,
          email: row.email,
          phone: row.phone,
        });

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
          .where(sql`${clientsTable.id} = ${existing.id}`);

        updated++;
        if (row.id != null) clientIdMap[String(row.id)] = existing.id;
      } else {
        const [created] = await db.insert(clientsTable).values({
          ...values,
          createdAt: new Date(),
        }).returning();

        inserted++;
        if (row.id != null) clientIdMap[String(row.id)] = created.id;
      }
    }

    res.json({ ok: true, inserted, updated, clientIdMap });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Import failed" });
  }
});

export default router;
