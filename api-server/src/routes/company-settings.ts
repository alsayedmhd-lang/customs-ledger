import { Router } from "express";
import { db, companySettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAdmin } from "../middleware/auth";
import { hashPassword } from "../utils/password";

const router = Router();

router.get("/company-settings", async (_req, res) => {
  try {
    let [settings] = await db.select().from(companySettingsTable).limit(1);

    if (!settings) {
      [settings] = await db.insert(companySettingsTable).values({ id: 1 }).returning();
    }

    const { masterPasswordHash, ...safeSettings } = settings as any;

    return res.json({
      ...safeSettings,
      invoiceCashTitleAr: settings.invoiceCashTitleAr,
      invoiceCashTitleEn: settings.invoiceCashTitleEn,
      invoiceCreditTitleAr: settings.invoiceCreditTitleAr,
      invoiceCreditTitleEn: settings.invoiceCreditTitleEn,
      invoiceTitleFontSize: settings.invoiceTitleFontSize,

      accountantSignatureBase64: settings.accountantSignatureBase64,
      receiverSignatureBase64: settings.receiverSignatureBase64,
      showAccountantSignature: settings.showAccountantSignature,
      showReceiverSignature: settings.showReceiverSignature,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch company settings" });
  }
});

router.put("/company-settings", requireAdmin, async (req, res) => {
  try {
    const body = req.body as any;

    let masterPasswordHash: string | undefined;

    if (body.masterPassword && String(body.masterPassword).trim()) {
      masterPasswordHash = await hashPassword(String(body.masterPassword).trim());
    }

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
      logoBase64: body.logoBase64 ?? null,
      logoSize: Number(body.logoSize ?? 80),
      stampBase64: body.stampBase64 ?? null,
      watermarkBase64: body.watermarkBase64 ?? null,
      showWatermark: body.showWatermark ?? false,
      showStampOnInvoices: body.showStampOnInvoices ?? false,
      showStampOnReceipts: body.showStampOnReceipts ?? false,
      showStampOnStatements: body.showStampOnStatements ?? false,
      footerText: body.footerText,
      invoiceCashTitleAr: body.invoiceCashTitleAr,
      invoiceCashTitleEn: body.invoiceCashTitleEn,
      invoiceCreditTitleAr: body.invoiceCreditTitleAr,
      invoiceCreditTitleEn: body.invoiceCreditTitleEn,
      invoiceTitleFontSize: Number(body.invoiceTitleFontSize),
      accountantSignatureBase64: body.accountantSignatureBase64 ?? null,
      receiverSignatureBase64: body.receiverSignatureBase64 ?? null,
      showAccountantSignature: body.showAccountantSignature ?? false,
      showReceiverSignature: body.showReceiverSignature ?? false,
      updatedAt: new Date(),
      ...(masterPasswordHash ? { masterPasswordHash } : {}),
    };

    let [existing] = await db.select().from(companySettingsTable).limit(1);

    if (!existing) {
      [existing] = await db.insert(companySettingsTable).values({ id: 1 }).returning();
    }

    const [result] = await db
      .update(companySettingsTable)
      .set(data as any)
      .where(eq(companySettingsTable.id, Number(existing.id)))
      .returning();

    const { masterPasswordHash: _hidden, ...safeResult } = result as any;

    return res.json(safeResult);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to update company settings" });
  }
});

export default router;