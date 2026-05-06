  import { Router, type IRouter } from "express";
  import { db, invoicesTable, receiptsTable, invoiceAccountingTable, clientsTable } from "@workspace/db";
  import { and, desc, eq, inArray, isNull } from "drizzle-orm";
  import { requireAuth } from "../middleware/auth";

  const router: IRouter = Router();

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

  type LedgerRow = {
    id: string;
    clientId: number;
    invoiceId: number | null;
    receiptId: number | null;
    entryDate: string;
    entryType: "invoice" | "advance_payment" | "receipt";
    descriptionAr: string;
    descriptionEn: string;
    referenceType: "invoice" | "receipt";
    referenceNumber: string;
    debit: number;
    credit: number;
    balanceImpact: number;
    createdBy: number | null;
  };

  function ledgerEntryPriority(row: LedgerRow) {
    if (row.entryType === "invoice") return 1;
    if (row.entryType === "advance_payment") return 2;
    if (row.entryType === "receipt") return 3;
    return 9;
  }

  async function getClientScope(req: any) {
    if (req.user?.role !== "client") return null;
    const tokenClientId = Number(req.user?.clientId || 0);
    const { usersTable } = await import("@workspace/db");
    const userId = Number(req.user?.userId || req.user?.id || 0);
    if (!Number.isInteger(userId) || userId <= 0) {
      return {
        clientId: Number.isInteger(tokenClientId) && tokenClientId > 0 ? tokenClientId : null,
        permissions: (req.user as any).clientViewPermissions ?? null,
        tokenClientId: Number.isInteger(tokenClientId) && tokenClientId > 0 ? tokenClientId : null,
        userTableClientId: null,
        resolvedFrom: Number.isInteger(tokenClientId) && tokenClientId > 0 ? "token" : null,
      };
    }

    const [user] = await db
      .select({ clientId: usersTable.clientId, clientViewPermissions: usersTable.clientViewPermissions })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    const userTableClientId = user?.clientId ? Number(user.clientId) : null;
    const resolvedClientId =
      Number.isInteger(tokenClientId) && tokenClientId > 0
        ? tokenClientId
        : userTableClientId;

    return {
      clientId: resolvedClientId,
      permissions: (req.user as any).clientViewPermissions ?? user?.clientViewPermissions ?? null,
      tokenClientId: Number.isInteger(tokenClientId) && tokenClientId > 0 ? tokenClientId : null,
      userTableClientId,
      resolvedFrom: Number.isInteger(tokenClientId) && tokenClientId > 0 ? "token" : userTableClientId ? "users.clientId" : null,
    };
  }

  router.get("/customer-ledger/:clientId", requireAuth, async (req, res) => {
    try {
      console.log("[customer-ledger route entered]", {
        reqUser: req.user,
        params: req.params,
        query: req.query,
      });

      const requestedClientId = Number(req.params.clientId);
      const clientScope = await getClientScope(req);
      const log403 = (reason: string, resolvedClientId: number | null) => {
        console.log(`[customer-ledger 403] reason=${reason}`, {
          paramClientId: requestedClientId,
          reqUser: req.user,
          role: req.user?.role,
          tokenClientId: clientScope?.tokenClientId ?? (req.user as any)?.clientId ?? null,
          userTableClientId: clientScope?.userTableClientId ?? null,
          resolvedClientId,
          resolvedFrom: clientScope?.resolvedFrom ?? null,
        });
      };

      res.on("finish", () => {
        if (res.statusCode === 403) {
          console.log("[customer-ledger 403] reason=unknown_finish", {
            paramClientId: requestedClientId,
            reqUser: req.user,
            role: req.user?.role,
            tokenClientId: clientScope?.tokenClientId ?? (req.user as any)?.clientId ?? null,
            userTableClientId: clientScope?.userTableClientId ?? null,
            resolvedClientId: clientScope?.clientId ?? null,
            resolvedFrom: clientScope?.resolvedFrom ?? null,
          });
        }
      });

      if (clientScope && !clientScope.clientId) {
        log403("missing_client_link", null);
        return res.status(403).json({ error: "Client is not linked" });
      }
      const clientId = clientScope ? Number(clientScope.clientId) : requestedClientId;

      if (!Number.isInteger(clientId) || clientId <= 0) {
        console.log("[customer-ledger backend]", {
          routeName: "GET /customer-ledger/:clientId",
          reqUser: req.user,
          paramClientId: requestedClientId,
          resolvedClientId: clientId,
          responseStatus: 400,
          reason: "invalid resolved clientId",
        });
        return res.status(400).json({ error: "Invalid clientId" });
      }
      const from = req.query.from ? String(req.query.from) : "";
      const to = req.query.to ? String(req.query.to) : "";
      const q = req.query.q ? String(req.query.q).trim().toLowerCase() : "";

      const [client] = await db
        .select()
        .from(clientsTable)
        .where(eq(clientsTable.id, clientId))
        .limit(1);

      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }

      const invoiceRows = clientScope
        ? await db
            .select()
            .from(invoicesTable)
            .where(eq(invoicesTable.clientId, clientId))
        : await db
            .select()
            .from(invoicesTable)
            .where(
              and(
                clientId > 0 ? eq(invoicesTable.clientId, clientId) : undefined,
                isNull(invoicesTable.deletedAt),
                inArray(invoicesTable.status, ["issued", "paid"])
              )
            );

      const receiptRows = await db
        .select()
        .from(receiptsTable)
        .where(and(eq(receiptsTable.clientId, clientId), isNull(receiptsTable.deletedAt)));

      const allRows: LedgerRow[] = [];

      for (const inv of invoiceRows) {
        const advance = Number(inv.advancePayment || 0);
        const invoiceTotal = getOriginalInvoiceTotal(inv);

        allRows.push({
          id: `invoice-${inv.id}`,
          clientId,
          invoiceId: inv.id,
          receiptId: null,
          entryDate: inv.issueDate,
          entryType: "invoice",
          descriptionAr: `\u0641\u0627\u062a\u0648\u0631\u0629 \u0631\u0642\u0645 ${inv.invoiceNumber}`,
          descriptionEn: `Invoice ${inv.invoiceNumber}`,
          referenceType: "invoice",
          referenceNumber: inv.invoiceNumber,
          debit: invoiceTotal,
          credit: 0,
          balanceImpact: invoiceTotal,
          createdBy: inv.createdBy ?? null,
        });

        if (advance > 0) {
          allRows.push({
            id: `advance-payment-${inv.id}`,
            clientId,
            invoiceId: inv.id,
            receiptId: null,
            entryDate: inv.issueDate,
            entryType: "advance_payment",
            descriptionAr: `\u062f\u0641\u0639\u0629 \u0645\u0642\u062f\u0645\u0629 \u0639\u0644\u0649 \u0641\u0627\u062a\u0648\u0631\u0629 \u0631\u0642\u0645 ${inv.invoiceNumber}`,
            descriptionEn: `Advance payment for invoice ${inv.invoiceNumber}`,
            referenceType: "invoice",
            referenceNumber: inv.invoiceNumber,
            debit: 0,
            credit: advance,
            balanceImpact: -advance,
            createdBy: inv.createdBy ?? null,
          });
        }
      }

      for (const rec of receiptRows) {
        const amount = Number(rec.amount || 0);

        allRows.push({
          id: `receipt-${rec.id}`,
          clientId,
          invoiceId: rec.invoiceId ?? null,
          receiptId: rec.id,
          entryDate: rec.receiptDate,
          entryType: "receipt",
          descriptionAr: `سند قبض رقم ${rec.receiptNumber}`,
          descriptionEn: `Receipt ${rec.receiptNumber}`,
          referenceType: "receipt",
          referenceNumber: rec.receiptNumber,
          debit: 0,
          credit: amount,
          balanceImpact: -amount,
          createdBy: rec.createdBy ?? null,
        });
      }

      const sortedRows = allRows
        .filter((row) => {
          if (from && row.entryDate < from) return false;
          if (to && row.entryDate > to) return false;
          if (
            q &&
            !row.referenceNumber.toLowerCase().includes(q) &&
            !row.descriptionAr.toLowerCase().includes(q) &&
            !row.descriptionEn.toLowerCase().includes(q)
          ) {
            return false;
          }
          return true;
        })
        .sort((a, b) => {
          const dateOrder = a.entryDate.localeCompare(b.entryDate);
          if (dateOrder !== 0) return dateOrder;

          const invoiceOrder = Number(a.invoiceId || 0) - Number(b.invoiceId || 0);
          if (invoiceOrder !== 0) return invoiceOrder;

          const priorityOrder = ledgerEntryPriority(a) - ledgerEntryPriority(b);
          if (priorityOrder !== 0) return priorityOrder;

          return a.id.localeCompare(b.id);
        });

      const previousRows = allRows.filter((row) => from && row.entryDate < from);
      const openingBalance = previousRows.reduce((sum, row) => sum + row.balanceImpact, 0);

      if (clientScope) {
        console.log("[customer-ledger backend]", {
          routeName: "GET /customer-ledger/:clientId",
          reqUser: req.user,
          paramClientId: requestedClientId,
          effectiveClientId: clientId,
          responseStatus: 200,
          rowsCount: sortedRows.length,
        });
      }

      res.json({
        client: {
          id: client.id,
          name: client.name,
          email: client.email ?? null,
          phone: client.phone ?? null,
          address: client.address ?? null,
        },
        rows: sortedRows,
        openingBalance,
      });
    } catch (err) {
      console.error("[GET /customer-ledger/:clientId ERROR]", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  router.patch("/accounting/:invoiceId", requireAuth, async (req, res) => {
    try {
      if (req.user?.role === "client") {
        return res.status(403).json({ error: "Client users have read-only access" });
      }
      const invoiceId = parseInt(req.params.invoiceId);
      const {
        payments,
        transportation,
        driverName,
        unloadLocation,
        labor,
        otherExpenses,
        transportationPaid,
        laborPaid,
        otherExpensesPaid,
      } = req.body;

      if (Number.isNaN(invoiceId)) {
        return res.status(400).json({ error: "Invalid invoice id" });
      }

      const isAdmin = req.user!.role === "admin" || req.user!.role === "supervisor";
      const userId = req.user!.userId;

      const invoiceWhere = isAdmin
        ? and(eq(invoicesTable.id, invoiceId), isNull(invoicesTable.deletedAt))
        : and(
            eq(invoicesTable.id, invoiceId),
            eq(invoicesTable.createdBy, userId),
            isNull(invoicesTable.deletedAt)
          );

      const [invoice] = await db
        .select({ id: invoicesTable.id })
        .from(invoicesTable)
        .where(invoiceWhere)
        .limit(1);

      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      const toNum = (v: unknown) =>
        v !== undefined && v !== null && v !== "" ? String(parseFloat(String(v))) : "0";

      const toStr = (v: unknown) =>
        v !== undefined && v !== null && String(v).trim() !== "" ? String(v) : null;

      const toBool = (v: unknown) => v === true || v === "true";

      const existing = await db
        .select()
        .from(invoiceAccountingTable)
        .where(eq(invoiceAccountingTable.invoiceId, invoiceId))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(invoiceAccountingTable)
          .set({
            payments: toNum(payments),
            transportation: toNum(transportation),
            driverName: toStr(driverName),
            unloadLocation: toStr(unloadLocation),
            labor: toNum(labor),
            otherExpenses: toNum(otherExpenses),
            transportationPaid: toBool(transportationPaid),
            laborPaid: toBool(laborPaid),
            otherExpensesPaid: toBool(otherExpensesPaid),
            updatedAt: new Date(),
          })
          .where(eq(invoiceAccountingTable.invoiceId, invoiceId));
      } else {
        await db.insert(invoiceAccountingTable).values({
          invoiceId,
          payments: toNum(payments),
          transportation: toNum(transportation),
          driverName: toStr(driverName),
          unloadLocation: toStr(unloadLocation),
          labor: toNum(labor),
          otherExpenses: toNum(otherExpenses),
          transportationPaid: toBool(transportationPaid),
          laborPaid: toBool(laborPaid),
          otherExpensesPaid: toBool(otherExpensesPaid),
        });
      }

      res.json({ ok: true });
    } catch (err) {
      console.error("[PATCH /accounting/:invoiceId ERROR]", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  router.get("/accounting", requireAuth, async (req, res) => {
    try {
      if (req.user?.role === "client") {
        return res.status(403).json({ error: "Accounting is not allowed for client users" });
      }
      const isAdmin = req.user!.role === "admin" || req.user!.role === "supervisor";
      const userId = req.user!.userId;
      const filters = [isNull(invoicesTable.deletedAt)];

      if (!isAdmin) {
        filters.push(eq(invoicesTable.createdBy, userId));
      }

      const rows = await db
        .select({
          id: invoicesTable.id,
          invoiceId: invoicesTable.id,
          invoiceNumber: invoicesTable.invoiceNumber,
          clientName: clientsTable.name,
          issueDate: invoicesTable.issueDate,
          subtotal: invoicesTable.subtotal,
          total: invoicesTable.total,
          payments: invoiceAccountingTable.payments,
          transportation: invoiceAccountingTable.transportation,
          driverName: invoiceAccountingTable.driverName,
          unloadLocation: invoiceAccountingTable.unloadLocation,
          labor: invoiceAccountingTable.labor,
          otherExpenses: invoiceAccountingTable.otherExpenses,
          transportationPaid: invoiceAccountingTable.transportationPaid,
          laborPaid: invoiceAccountingTable.laborPaid,
          otherExpensesPaid: invoiceAccountingTable.otherExpensesPaid,
        })
        .from(invoicesTable)
        .innerJoin(clientsTable, eq(invoicesTable.clientId, clientsTable.id))
        .leftJoin(invoiceAccountingTable, eq(invoiceAccountingTable.invoiceId, invoicesTable.id))
        .where(and(...filters))
        .orderBy(desc(invoicesTable.id));

      res.json(
        rows.map((row) => ({
          id: row.id,
          invoiceId: row.invoiceId,
          invoiceNumber: row.invoiceNumber,
          clientName: row.clientName,
          issueDate: row.issueDate,
          subtotal: Number(row.subtotal ?? 0),
          total: Number(row.total ?? 0),
          payments: Number(row.payments ?? 0),
          transportation: Number(row.transportation ?? 0),
          driverName: row.driverName ?? null,
          unloadLocation: row.unloadLocation ?? null,
          labor: Number(row.labor ?? 0),
          otherExpenses: Number(row.otherExpenses ?? 0),
          transportationPaid: row.transportationPaid ?? false,
          laborPaid: row.laborPaid ?? false,
          otherExpensesPaid: row.otherExpensesPaid ?? false,
        }))
      );
    } catch (err) {
      console.error("[GET /accounting ERROR]", err);
      res.status(500).json({ error: "Failed to load accounting" });
    }
  });

  export default router;
