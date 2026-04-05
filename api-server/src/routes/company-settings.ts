import { Router } from "express";
import { db } from "@workspace/db";
import { companySettingsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middleware/auth";

const router = Router();

router.get("/company-settings", requireAuth, async (_req, res) => {
  try {
    let [settings] = await db.select().from(companySettingsTable).limit(1);
    if (!settings) {
      [settings] = await db.insert(companySettingsTable).values({}).returning();
    }
    return res.json(settings);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch company settings" });
  }
});

router.put("/company-settings", requireAdmin, async (req, res) => {
  try {
    const data = req.body as Partial<typeof companySettingsTable.$inferInsert>;
    const [existing] = await db.select().from(companySettingsTable).limit(1);
    let result;
    if (existing) {
      [result] = await db
        .update(companySettingsTable)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(companySettingsTable.id, existing.id))
        .returning();
    } else {
      [result] = await db.insert(companySettingsTable).values(data as any).returning();
    }
    return res.json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to update company settings" });
  }
});

export default router;
