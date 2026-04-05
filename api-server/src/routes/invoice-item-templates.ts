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
    defaultUnitPrice: parseFloat(t.defaultUnitPrice ?? "0"),
    createdAt: t.createdAt.toISOString(),
  };
}

export default router;
