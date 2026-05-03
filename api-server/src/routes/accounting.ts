  import { Router, type IRouter } from "express";
  import { db, invoicesTable, receiptsTable, invoiceAccountingTable } from "@workspace/db";
  import { and, eq, inArray, isNull } from "drizzle-orm";
  import { requireAuth } from "../middleware/auth";

  const router: IRouter = Router();

  type LedgerRow = {
    id: string;
    clientId: number;
    invoiceId: number | null;
    receiptId: number | null;
    entryDate: string;
    entryType: "invoice" | "advance" | "receipt";
    descriptionAr: string;
    descriptionEn: string;
    referenceType: "invoice" | "receipt";
    referenceNumber: string;
    debit: number;
    credit: number;
    balanceImpact: number;
    createdBy: number | null;
  };

  router.get("/customer-ledger/:clientId", requireAuth, async (req, res) => {
    try {
      const clientId = Number(req.params.clientId);
      const from = req.query.from ? String(req.query.from) : "";
      const to = req.query.to ? String(req.query.to) : "";

      if (!Number.isInteger(clientId) || clientId <= 0) {
        return res.status(400).json({ error: "Invalid clientId" });
      }

      const invoiceRows = await db
        .select()
        .from(invoicesTable)
        .where(
          and(
            eq(invoicesTable.clientId, clientId),
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
        const grossTotal = Number(inv.subtotal || 0) + Number(inv.taxAmount || 0);

        allRows.push({
          id: `invoice-${inv.id}`,
          clientId,
          invoiceId: inv.id,
          receiptId: null,
          entryDate: inv.issueDate,
          entryType: "invoice",
          descriptionAr: `فاتورة رقم ${inv.invoiceNumber}`,
          descriptionEn: `Invoice ${inv.invoiceNumber}`,
          referenceType: "invoice",
          referenceNumber: inv.invoiceNumber,
          debit: grossTotal,
          credit: 0,
          balanceImpact: grossTotal,
          createdBy: inv.createdBy ?? null,
        });

        const hasReceipt = receiptRows.some(r => r.invoiceId === inv.id);

        if (advance > 0 && !hasReceipt) {
          allRows.push({
            id: `advance-${inv.id}`,
            clientId,
            invoiceId: inv.id,
            receiptId: null,
            entryDate: inv.issueDate,
            entryType: "advance",
            descriptionAr: `دفعة مقدمة على فاتورة رقم ${inv.invoiceNumber}`,
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
          return true;
        })
        .sort((a, b) => {
          if (a.entryDate === b.entryDate) return a.id.localeCompare(b.id);
          return a.entryDate.localeCompare(b.entryDate);
        });

      const previousRows = allRows.filter((row) => from && row.entryDate < from);
      const openingBalance = previousRows.reduce((sum, row) => sum + row.balanceImpact, 0);

      res.json({
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

  export default router;