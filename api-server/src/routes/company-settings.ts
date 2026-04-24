import { Router } from "express";
import { db, companySettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middleware/auth";

const router = Router();

router.get("/company-settings", async (_req, res) => {
  try {
    let [settings] = await db.select().from(companySettingsTable).limit(1);

    if (!settings) {
      [settings] = await db.insert(companySettingsTable).values({ id: 1 }).returning();
    }

    return res.json({
      ...settings,
      invoiceCashTitleAr: settings.invoiceCashTitleAr,
      invoiceCashTitleEn: settings.invoiceCashTitleEn,
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
      invoiceCashTitleAr: body.invoiceCashTitleAr,
      invoiceCashTitleEn: body.invoiceCashTitleEn,
      invoiceCreditTitleAr: body.invoiceCreditTitleAr,
      invoiceCreditTitleEn: body.invoiceCreditTitleEn,
      invoiceTitleFontSize: Number(body.invoiceTitleFontSize),
      updatedAt: new Date(),
    };

    let [existing] = await db.select().from(companySettingsTable).limit(1);

    if (!existing) {
      [existing] = await db.insert(companySettingsTable).values({ id: 1 }).returning();
    }

    const [result] = await db
      .update(companySettingsTable)
      .set(data as any)
      // .where(eq(companySettingsTable.id, Number(existing.id)))
      .returning();

    return res.json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to update company settings" });
  }
});

export default router;