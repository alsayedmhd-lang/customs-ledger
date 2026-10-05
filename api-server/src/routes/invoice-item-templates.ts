import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import { sqlite, invoiceItemTemplatesTable } from "@workspace/db";
import { eq, asc, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";

import { ensureLocalTemplateNumbers } from "../utils/template-numbering";

function templateDb() {
  if (!sqlite) throw new Error("SQLite database is unavailable");
  return drizzle(sqlite);
}

const router: IRouter = Router();
router.use((_req, _res, next) => {
  try { ensureLocalTemplateNumbers(); next(); } catch (error) { next(error); }
});

router.get("/invoice-item-templates", async (req, res) => {
  try {
    if ((req as any).user?.role === "client") {
      res.status(403).json({ error: "Templates are not allowed for client users" });
      return;
    }
    const templates = await templateDb()
      .select()
      .from(invoiceItemTemplatesTable)
      .orderBy(sql`${invoiceItemTemplatesTable.displayCode} IS NULL`, asc(invoiceItemTemplatesTable.displayCode), asc(invoiceItemTemplatesTable.createdAt), asc(invoiceItemTemplatesTable.itemCode));
    res.json(templates.map(formatTemplate));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/invoice-item-templates", async (req, res) => {
  try {
    if ((req as any).user?.role === "client") {
      res.status(403).json({ error: "Client users have read-only access" });
      return;
    }
    const { description, defaultUnitPrice } = req.body;
    if (!description) {
      res.status(400).json({ error: "description is required" });
      return;
    }
    const [template] = await templateDb()
      .insert(invoiceItemTemplatesTable)
      .values({
        description,
        itemCode: `X-${randomUUID()}`,
        createdAt: new Date(),
        defaultUnitPrice: Number(parseFloat(defaultUnitPrice ?? "0").toFixed(2)),
      })
      .returning();
    res.status(201).json(formatTemplate(template));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/invoice-item-templates/:id", async (req, res) => {
  try {
    if ((req as any).user?.role === "client") {
      res.status(403).json({ error: "Client users have read-only access" });
      return;
    }
    const id = parseInt(String(req.params.id), 10);
    const { description, defaultUnitPrice } = req.body;
    if (!description) {
      res.status(400).json({ error: "description is required" });
      return;
    }
    const [template] = await templateDb()
      .update(invoiceItemTemplatesTable)
      .set({
        description,
        defaultUnitPrice: Number(parseFloat(defaultUnitPrice ?? "0").toFixed(2)),
      })
      .where(eq(invoiceItemTemplatesTable.id, id))
      .returning();
    if (!template) {
      res.status(404).json({ error: "Template not found" });
      return;
    }
    res.json(formatTemplate(template));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/invoice-item-templates/:id", async (req, res) => {
  try {
    if ((req as any).user?.role === "client") {
      res.status(403).json({ error: "Client users have read-only access" });
      return;
    }
    const id = parseInt(String(req.params.id), 10);
    await templateDb().delete(invoiceItemTemplatesTable).where(eq(invoiceItemTemplatesTable.id, id));
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

function formatTemplate(t: typeof invoiceItemTemplatesTable.$inferSelect) {
  return {
    id: t.id,
    itemCode: t.displayCode == null ? null : String(t.displayCode),
    syncCode: t.itemCode,
    description: t.description,
    defaultUnitPrice: t.defaultUnitPrice,
    createdAt: t.createdAt ? new Date(t.createdAt).toISOString() : null,
  };
}

router.post("/invoice-item-templates/import", async (req: any, res: any) => {
  try {
    if (req.user?.role === "client") {
      res.status(403).json({ error: "Client users have read-only access" });
      return;
    }
    const rows = req.body.data;

    if (!Array.isArray(rows)) {
      res.status(400).json({ error: "Invalid data" });
      return;
    }

    let inserted = 0;
    let updated = 0;

    for (const row of rows) {
      const [existing] = await templateDb()
        .select()
        .from(invoiceItemTemplatesTable)
        .where(eq(invoiceItemTemplatesTable.description, row.description))
        .limit(1);

      const values = {
        description: String(row.description),
        defaultUnitPrice: Number(row.defaultUnitPrice ?? 0),
      };

      if (existing) {
        await templateDb()
          .update(invoiceItemTemplatesTable)
          .set(values)
          .where(eq(invoiceItemTemplatesTable.id, existing.id));

        updated++;
      } else {
        await templateDb().insert(invoiceItemTemplatesTable).values({
          ...values,
          itemCode: `X-${randomUUID()}`,
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
