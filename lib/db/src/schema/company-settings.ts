import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const companySettingsTable = pgTable("company_settings", {
  id: serial("id").primaryKey(),
  nameAr: text("name_ar").notNull().default("حول العالم للتخليص الجمركي"),
  nameEn: text("name_en").notNull().default("Around The World Customs Clearance"),
  subtitleAr: text("subtitle_ar").default("للتخليص الجمركي"),
  subtitleEn: text("subtitle_en").default("Customs Clearance"),
  taglineAr: text("tagline_ar").default("خدمات التخليص الجمركي والشحن"),
  taglineEn: text("tagline_en").default("Customs Clearance & Shipping Services"),
  email: text("email").default("atwcc1246@gmail.com"),
  phone: text("phone").default("55251595"),
  address: text("address").default("Doha, Qatar"),
  poBox: text("po_box").default("P.O BOX 8180"),
  website: text("website"),
  crNumber: text("cr_number"),
  taxNumber: text("tax_number"),
  logoBase64: text("logo_base64"),
  stampBase64: text("stamp_base64"),
  watermarkBase64: text("watermark_base64"),
  showWatermark: boolean("show_watermark").notNull().default(true),
  showStampOnInvoices: boolean("show_stamp_on_invoices").notNull().default(true),
  showStampOnReceipts: boolean("show_stamp_on_receipts").notNull().default(true),
  showStampOnStatements: boolean("show_stamp_on_statements").notNull().default(true),
  footerText: text("footer_text"),

  invoiceCashTitleAr: text("invoice_cash_title_ar"),
  invoiceCashTitleEn: text("invoice_cash_title_en"),
  invoiceCreditTitleAr: text("invoice_credit_title_ar"),
  invoiceCreditTitleEn: text("invoice_credit_title_en"),
  invoiceTitleFontSize: text("invoice_title_font_size"),
  
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type CompanySettings = typeof companySettingsTable.$inferSelect;
export type InsertCompanySettings = typeof companySettingsTable.$inferInsert;
