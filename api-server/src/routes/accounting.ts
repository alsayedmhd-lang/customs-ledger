import { Router, type IRouter } from "express";
import { db, invoicesTable, clientsTable, invoiceAccountingTable } from "@workspace/db";
import { eq, isNull, desc, and } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";

const router: IRouter = Router();

router.get("/accounting", requireAuth, async (req, res) => {
  try {
    const isAdmin = req.user!.role === "admin" || req.user!.role === "supervisor";
    const userId = req.user!.userId;

    const whereClause = isAdmin
      ? isNull(invoicesTable.deletedAt)
      : and(isNull(invoicesTable.deletedAt), eq(invoicesTable.createdBy, userId));

    const rows = await db
      .select({
        id: invoicesTable.id,
        invoiceNumber: invoicesTable.invoiceNumber,
        clientId: invoicesTable.clientId,
        clientName: clientsTable.name,
        issueDate: invoicesTable.issueDate,
        subtotal: invoicesTable.subtotal,
        taxAmount: invoicesTable.taxAmount,
        accId: invoiceAccountingTable.id,
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
      .where(whereClause)
      .orderBy(desc(invoicesTable.createdAt));

    res.json(
      rows.map((r) => ({
        id: r.id,
        invoiceNumber: r.invoiceNumber,
        clientName: r.clientName,
        issueDate: r.issueDate,
        total: parseFloat(r.subtotal ?? "0") + parseFloat(r.taxAmount ?? "0"),
        payments: parseFloat(r.payments ?? "0"),
        transportation: parseFloat(r.transportation ?? "0"),
        driverName: r.driverName ?? "",
        unloadLocation: r.unloadLocation ?? "",
        labor: parseFloat(r.labor ?? "0"),
        otherExpenses: parseFloat(r.otherExpenses ?? "0"),
        transportationPaid: r.transportationPaid ?? false,
        laborPaid: r.laborPaid ?? false,
        otherExpensesPaid: r.otherExpensesPaid ?? false,
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/accounting/:invoiceId", async (req, res) => {
  try {
    const invoiceId = parseInt(req.params.invoiceId);
    const {
      payments, transportation, driverName, unloadLocation,
      labor, otherExpenses,
      transportationPaid, laborPaid, otherExpensesPaid,
    } = req.body;

    const toNum = (v: unknown) =>
      v !== undefined && v !== null && v !== "" ? String(parseFloat(String(v))) : "0";
    const toStr = (v: unknown) => (v !== undefined && v !== null ? String(v) : null);
    const toBool = (v: unknown) => (v === true || v === "true" ? true : false);

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
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
