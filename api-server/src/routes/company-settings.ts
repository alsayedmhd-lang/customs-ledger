import { Router } from "express";
import { db } from "@workspace/db";
import { eq } from "drizzle-orm";
import { companySettingsTable } from "@workspace/db/schema";
import { requireAuth, requireAdmin } from "../middleware/auth";

const router = Router();

router.get("/company-settings", requireAuth, async (_req, res) => {
  try {
    let [settings] = await db.select().from(companySettingsTable).limit(1);
    if (!settings) {
      [settings] = await db.insert(companySettingsTable).values({ id: 1 }).returning();
    }
    return res.json({
      ...settings,
      invoiceCreditTitleAr: settings.invoiceCreditTitleAr,
      invoiceCreditTitleEn: settings.invoiceCreditTitleEn,
      invoiceTitleFontSize: settings.invoiceTitleFontSize,
});
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch company settings" });
  }
});

router.put("/company-settings", requireAdmin, async (req, res) => {
  try {
    const body = req.body as any;

    const data = {
      nameAr: body.nameAr,
      nameEn: body.nameEn,
      subtitleAr: body.subtitleAr,
      subtitleEn: body.subtitleEn,
      taglineAr: body.taglineAr,
      taglineEn: body.taglineEn,
      email: body.email,
      phone: body.phone,
      address: body.address,
      poBox: body.poBox,
      website: body.website,
      crNumber: body.crNumber,
      taxNumber: body.taxNumber,
      logoBase64: body.logoBase64,
      stampBase64: body.stampBase64,
      watermarkBase64: body.watermarkBase64,
      showWatermark: body.showWatermark,
      showStampOnInvoices: body.showStampOnInvoices,
      showStampOnReceipts: body.showStampOnReceipts,
      showStampOnStatements: body.showStampOnStatements,
      footerText: body.footerText,
      invoiceCreditTitleAr: body.invoiceCreditTitleAr,
      invoiceCreditTitleEn: body.invoiceCreditTitleEn,
      invoiceTitleFontSize: Number(body.invoiceTitleFontSize),
      id: 1
    };
    delete (data as any).updatedAt;
    await db.execute("insert into company_settings (id) values (1) on conflict (id) do nothing");

    const [result] = await db
      .update(companySettingsTable)
      .set(data as any)
      .where(eq(companySettingsTable.id, 1))
      .returning();

return res.json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to update company settings" });
  }
});

export default router;
