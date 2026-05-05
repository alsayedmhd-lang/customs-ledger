import { Router } from "express";
import { db, sqlite, companySettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAdmin } from "../middleware/auth";
import { hashPassword } from "../utils/password";

const router = Router();

function ensureCompanySettingsPrintTitleColumns() {
  if (!sqlite) return;
  const table = sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'company_settings'").get();
  if (!table) return;

  const columns = sqlite.prepare("PRAGMA table_info(company_settings)").all() as Array<{ name: string }>;
  const existing = new Set(columns.map((column) => column.name));
  const statements = [
    ["invoice_title_visible", "ALTER TABLE company_settings ADD COLUMN invoice_title_visible INTEGER DEFAULT 1"],
    ["invoice_title_align", "ALTER TABLE company_settings ADD COLUMN invoice_title_align TEXT DEFAULT 'center'"],
    ["invoice_title_bold", "ALTER TABLE company_settings ADD COLUMN invoice_title_bold INTEGER DEFAULT 1"],
    ["invoice_subtitle_ar", "ALTER TABLE company_settings ADD COLUMN invoice_subtitle_ar TEXT DEFAULT ''"],
    ["invoice_subtitle_en", "ALTER TABLE company_settings ADD COLUMN invoice_subtitle_en TEXT DEFAULT ''"],
    ["invoice_subtitle_font_size", "ALTER TABLE company_settings ADD COLUMN invoice_subtitle_font_size INTEGER DEFAULT 12"],
    ["statement_title_ar", "ALTER TABLE company_settings ADD COLUMN statement_title_ar TEXT DEFAULT 'كشف حساب'"],
    ["statement_title_en", "ALTER TABLE company_settings ADD COLUMN statement_title_en TEXT DEFAULT 'Statement'"],
    ["statement_title_font_size", "ALTER TABLE company_settings ADD COLUMN statement_title_font_size INTEGER DEFAULT 18"],
    ["statement_title_visible", "ALTER TABLE company_settings ADD COLUMN statement_title_visible INTEGER DEFAULT 1"],
    ["statement_title_align", "ALTER TABLE company_settings ADD COLUMN statement_title_align TEXT DEFAULT 'center'"],
    ["statement_title_bold", "ALTER TABLE company_settings ADD COLUMN statement_title_bold INTEGER DEFAULT 1"],
    ["statement_subtitle_ar", "ALTER TABLE company_settings ADD COLUMN statement_subtitle_ar TEXT DEFAULT ''"],
    ["statement_subtitle_en", "ALTER TABLE company_settings ADD COLUMN statement_subtitle_en TEXT DEFAULT ''"],
    ["statement_subtitle_font_size", "ALTER TABLE company_settings ADD COLUMN statement_subtitle_font_size INTEGER DEFAULT 12"],
    ["customer_ledger_title_ar", "ALTER TABLE company_settings ADD COLUMN customer_ledger_title_ar TEXT DEFAULT 'ملخص العميل المالي'"],
    ["customer_ledger_title_en", "ALTER TABLE company_settings ADD COLUMN customer_ledger_title_en TEXT DEFAULT 'Customer Financial Summary'"],
    ["customer_ledger_title_font_size", "ALTER TABLE company_settings ADD COLUMN customer_ledger_title_font_size INTEGER DEFAULT 18"],
    ["customer_ledger_title_visible", "ALTER TABLE company_settings ADD COLUMN customer_ledger_title_visible INTEGER DEFAULT 1"],
    ["customer_ledger_title_align", "ALTER TABLE company_settings ADD COLUMN customer_ledger_title_align TEXT DEFAULT 'center'"],
    ["customer_ledger_title_bold", "ALTER TABLE company_settings ADD COLUMN customer_ledger_title_bold INTEGER DEFAULT 1"],
    ["customer_ledger_subtitle_ar", "ALTER TABLE company_settings ADD COLUMN customer_ledger_subtitle_ar TEXT DEFAULT ''"],
    ["customer_ledger_subtitle_en", "ALTER TABLE company_settings ADD COLUMN customer_ledger_subtitle_en TEXT DEFAULT ''"],
    ["customer_ledger_subtitle_font_size", "ALTER TABLE company_settings ADD COLUMN customer_ledger_subtitle_font_size INTEGER DEFAULT 12"],
  ];

  for (const [column, sql] of statements) {
    if (!existing.has(column)) sqlite.exec(sql);
  }
}

ensureCompanySettingsPrintTitleColumns();

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
      invoiceTitleVisible: settings.invoiceTitleVisible ?? true,
      invoiceTitleAlign: settings.invoiceTitleAlign || "center",
      invoiceTitleBold: settings.invoiceTitleBold ?? true,
      invoiceSubtitleAr: settings.invoiceSubtitleAr || "",
      invoiceSubtitleEn: settings.invoiceSubtitleEn || "",
      invoiceSubtitleFontSize: settings.invoiceSubtitleFontSize || 12,
      statementTitleAr: settings.statementTitleAr || "كشف حساب",
      statementTitleEn: settings.statementTitleEn || "Statement",
      statementTitleFontSize: settings.statementTitleFontSize || 18,
      statementTitleVisible: settings.statementTitleVisible ?? true,
      statementTitleAlign: settings.statementTitleAlign || "center",
      statementTitleBold: settings.statementTitleBold ?? true,
      statementSubtitleAr: settings.statementSubtitleAr || "",
      statementSubtitleEn: settings.statementSubtitleEn || "",
      statementSubtitleFontSize: settings.statementSubtitleFontSize || 12,
      customerLedgerTitleAr: settings.customerLedgerTitleAr || "ملخص العميل المالي",
      customerLedgerTitleEn: settings.customerLedgerTitleEn || "Customer Financial Summary",
      customerLedgerTitleFontSize: settings.customerLedgerTitleFontSize || 18,
      customerLedgerTitleVisible: settings.customerLedgerTitleVisible ?? true,
      customerLedgerTitleAlign: settings.customerLedgerTitleAlign || "center",
      customerLedgerTitleBold: settings.customerLedgerTitleBold ?? true,
      customerLedgerSubtitleAr: settings.customerLedgerSubtitleAr || "",
      customerLedgerSubtitleEn: settings.customerLedgerSubtitleEn || "",
      customerLedgerSubtitleFontSize: settings.customerLedgerSubtitleFontSize || 12,

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
      invoiceTitleVisible: body.invoiceTitleVisible ?? true,
      invoiceTitleAlign: body.invoiceTitleAlign || "center",
      invoiceTitleBold: body.invoiceTitleBold ?? true,
      invoiceSubtitleAr: body.invoiceSubtitleAr || "",
      invoiceSubtitleEn: body.invoiceSubtitleEn || "",
      invoiceSubtitleFontSize: Number(body.invoiceSubtitleFontSize ?? 12),
      statementTitleAr: body.statementTitleAr || "كشف حساب",
      statementTitleEn: body.statementTitleEn || "Statement",
      statementTitleFontSize: Number(body.statementTitleFontSize ?? 18),
      statementTitleVisible: body.statementTitleVisible ?? true,
      statementTitleAlign: body.statementTitleAlign || "center",
      statementTitleBold: body.statementTitleBold ?? true,
      statementSubtitleAr: body.statementSubtitleAr || "",
      statementSubtitleEn: body.statementSubtitleEn || "",
      statementSubtitleFontSize: Number(body.statementSubtitleFontSize ?? 12),
      customerLedgerTitleAr: body.customerLedgerTitleAr || "ملخص العميل المالي",
      customerLedgerTitleEn: body.customerLedgerTitleEn || "Customer Financial Summary",
      customerLedgerTitleFontSize: Number(body.customerLedgerTitleFontSize ?? 18),
      customerLedgerTitleVisible: body.customerLedgerTitleVisible ?? true,
      customerLedgerTitleAlign: body.customerLedgerTitleAlign || "center",
      customerLedgerTitleBold: body.customerLedgerTitleBold ?? true,
      customerLedgerSubtitleAr: body.customerLedgerSubtitleAr || "",
      customerLedgerSubtitleEn: body.customerLedgerSubtitleEn || "",
      customerLedgerSubtitleFontSize: Number(body.customerLedgerSubtitleFontSize ?? 12),
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

    const lockedChanges: string[] = [];
    const isChanged = (key: string) => String((existing as any)[key] ?? "") !== String((data as any)[key] ?? "");

    if ((existing as any).lockCompanyIdentity) {
      for (const key of ["nameAr", "nameEn", "subtitleAr", "subtitleEn", "taglineAr", "taglineEn"]) {
        if (isChanged(key)) lockedChanges.push(key);
      }
    }
    if ((existing as any).lockCompanyName) {
      for (const key of ["nameAr", "nameEn"]) {
        if (isChanged(key)) lockedChanges.push(key);
      }
    }
    if ((existing as any).lockLogo && isChanged("logoBase64")) lockedChanges.push("logoBase64");
    if ((existing as any).lockStamp && isChanged("stampBase64")) lockedChanges.push("stampBase64");
    if ((existing as any).lockLegalInfo) {
      for (const key of ["crNumber", "taxNumber", "email", "phone", "address", "poBox", "website"]) {
        if (isChanged(key)) lockedChanges.push(key);
      }
    }
    if ((existing as any).lockFooterBranding && isChanged("footerText")) lockedChanges.push("footerText");
    if ((existing as any).preventRebrandToAnotherCompany) {
      const licensedName = String((existing as any).licensedCompanyName || "").trim();
      if (licensedName && String(data.nameEn || data.nameAr || "").trim() !== licensedName) {
        lockedChanges.push("licensedCompanyName");
      }
    }

    if (lockedChanges.length > 0) {
      return res.status(403).json({
        error: "Developer lock prevents changing protected company settings",
        lockedFields: Array.from(new Set(lockedChanges)),
      });
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
