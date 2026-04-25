import { Router, type IRouter } from "express";
import { db, invoiceItemTemplatesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router: IRouter = Router();

router.get("/invoice-item-templates", async (_req, res) => {
  try {
    const templates = await db
      .select()
      .from(invoiceItemTemplatesTable)
      .orderBy(desc(invoiceItemTemplatesTable.createdAt));
    res.json(templates.map(formatTemplate));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/invoice-item-templates", async (req, res) => {
  try {
    const { description, defaultUnitPrice } = req.body;
    if (!description) {
      res.status(400).json({ error: "description is required" });
      return;
    }
    const [template] = await db
      .insert(invoiceItemTemplatesTable)
      .values({
        description,
        defaultUnitPrice: parseFloat(defaultUnitPrice ?? "0").toFixed(2),
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
    const id = parseInt(req.params.id);
    const { description, defaultUnitPrice } = req.body;
    if (!description) {
      res.status(400).json({ error: "description is required" });
      return;
    }
    const [template] = await db
      .update(invoiceItemTemplatesTable)
      .set({
        description,
        defaultUnitPrice: parseFloat(defaultUnitPrice ?? "0").toFixed(2),
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
    const id = parseInt(req.params.id);
    await db.delete(invoiceItemTemplatesTable).where(eq(invoiceItemTemplatesTable.id, id));
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

function formatTemplate(t: typeof invoiceItemTemplatesTable.$inferSelect) {
  return {
    id: t.id,
    description: t.description,
    defaultUnitPrice: t.defaultUnitPrice,
    createdAt: t.createdAt ? new Date(t.createdAt).toISOString() : null,
  };
}

router.post("/invoice-item-templates/import", async (req: any, res: any) => {
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
        .from(invoiceItemTemplatesTable)
        .where(eq(invoiceItemTemplatesTable.description, row.description))
        .limit(1);

      const values = {
        description: String(row.description),
        defaultUnitPrice: String(row.defaultUnitPrice ?? "0"),
      };

      if (existing) {
        await db
          .update(invoiceItemTemplatesTable)
          .set(values)
          .where(eq(invoiceItemTemplatesTable.id, existing.id));

        updated++;
      } else {
        await db.insert(invoiceItemTemplatesTable).values({
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
