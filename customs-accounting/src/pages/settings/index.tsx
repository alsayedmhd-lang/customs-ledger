import InvoicePrintHeader from "@/components/invoice-print-header";
import {
  PrintDocumentFooter,
  PrintSignaturesStamp,
  PrintWatermark,
  ReceiptPrintHeader,
  StatementPrintHeader,
  StatementStamp,
} from "@/components/print-document-parts";
import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import { useCompanySettings, DEFAULT_SETTINGS, type CompanySettings } from "@/lib/company-settings-context";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Building2, Globe, Phone, Mail, MapPin, Hash, Upload, Save, RefreshCw,
  Stamp, Eye, EyeOff, Shield, Printer, Info, Image, RotateCcw, User,
  Palette, Sun, Moon, Monitor, Zap, ZapOff, Layers, RectangleHorizontal, Square, Minus,
  AlignVerticalJustifyStart, AlignVerticalJustifyCenter, AlignVerticalSpaceAround,
  Wallpaper, SlidersHorizontal, Ban, Blend, Database, Cloud,
} from "lucide-react";
import { useDisplaySettings, COLOR_PRESETS, SIDEBAR_COLOR_PRESETS, type PrimaryColor, type BorderRadius, type Density, type SidebarColor, type BgType } from "@/lib/display-settings-context";

type TabId = "preview" | "backup" | "company" | "branding" | "print" | "display" | "update";
type BackupView = "backup-import" | "database-sync";
type DatabaseMode = "local" | "online";
type SyncMode = "local-to-online" | "online-to-local" | "bidirectional";
type AutoSyncTiming = "startup" | "interval";
type SyncStatus = "idle" | "success" | "failed" | "in-progress";

const API_BASE = `${import.meta.env.VITE_API_BASE_URL}/api`;

const formatDateYMD = (value: Date | string | null | undefined = new Date()) => {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (!value) return new Date().toISOString().slice(0, 10);

  const normalized = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(normalized)) return normalized.slice(0, 10);

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? normalized : parsed.toISOString().slice(0, 10);
};

function Section({ icon: Icon, title, color, children, contentClassName }: {
  icon: React.ElementType; title: string; color: string; children: React.ReactNode; contentClassName?: string;
}) {
  return (
    <div className="w-full bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden">
      <div className={`flex items-center gap-2 px-5 py-3.5 border-b border-border/40 ${color}`}>
        <Icon className="w-3.5 h-3.5" />
        <h2 className="text-sm font-bold">{title}</h2>
      </div>
      <div className={cn("w-full p-5", contentClassName)}>{children}</div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

type TitleDisplayOptions = {
  enabled: boolean;
  align: "left" | "center" | "right";
  bold: boolean;
  subtitleAr: string;
  subtitleEn: string;
  subtitleSize: number;
};

function TitleOptionsGrid({
  title,
  isAR,
  value,
  onChange,
}: {
  title: string;
  isAR: boolean;
  value: TitleDisplayOptions;
  onChange: (next: TitleDisplayOptions) => void;
}) {
  const update = (patch: Partial<TitleDisplayOptions>) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-2">
      <div className="text-xs font-bold text-muted-foreground">{title}</div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <div className="space-y-1">
          <div className="text-[11px] font-medium text-muted-foreground">{isAR ? "تفعيل" : "Toggle"}</div>
          <label className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={value.enabled}
              onChange={(e) => update({ enabled: e.target.checked })}
              className="h-4 w-4 accent-primary"
            />
            <span>{isAR ? "إظهار العنوان" : "Show title"}</span>
          </label>
        </div>

        <Field label={isAR ? "المحاذاة" : "Align"}>
          <select
            value={value.align}
            onChange={(e) => update({ align: e.target.value as TitleDisplayOptions["align"] })}
            className={inp}
            dir="ltr"
          >
            <option value="right">right</option>
            <option value="center">center</option>
            <option value="left">left</option>
          </select>
        </Field>

        <div className="space-y-1">
          <div className="text-[11px] font-medium text-muted-foreground">{isAR ? "عريض" : "Bold"}</div>
          <label className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={value.bold}
              onChange={(e) => update({ bold: e.target.checked })}
              className="h-4 w-4 accent-primary"
            />
            <span>{isAR ? "عريض" : "Bold"}</span>
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <Field label={isAR ? "العربية" : "Arabic"}>
          <input
            value={value.subtitleAr}
            onChange={(e) => update({ subtitleAr: e.target.value })}
            className={inp}
          />
        </Field>

        <Field label={isAR ? "English" : "English"}>
          <input
            value={value.subtitleEn}
            onChange={(e) => update({ subtitleEn: e.target.value })}
            className={inp}
            dir="ltr"
          />
        </Field>

        <Field label={isAR ? "الحجم" : "Size"}>
          <input
            type="number"
            value={value.subtitleSize}
            onChange={(e) => update({ subtitleSize: Number(e.target.value) })}
            className={inp}
          />
        </Field>
      </div>
    </div>
  );
}

function PreviewShell({
  title,
  size,
  scale,
  children,
}: {
  title: string;
  size: "large" | "medium" | "small";
  scale: number;
  children: React.ReactNode;
}) {
  const preview = {
    large: {
      sourceWidth: 1120,
      sourceHeight: 900,
      initialHeight: 700,
      minHeight: 420,
    },
    medium: {
      sourceWidth: 840,
      sourceHeight: 700,
      initialHeight: 560,
      minHeight: 320,
    },
    small: {
      sourceWidth: 840,
      sourceHeight: 720,
      initialHeight: 560,
      minHeight: 320,
    },
  }[size];
  const scaledWidth = Math.ceil(preview.sourceWidth * scale);
  const scaledHeight = Math.ceil(preview.sourceHeight * scale);

  return (
    <div className="w-full rounded-xl border border-border bg-muted/20 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-card">
        <h3 className="text-sm font-bold text-foreground">{title}</h3>
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Print Preview</span>
      </div>
      <div
        className="overflow-auto bg-slate-100 p-1"
        style={{
          height: preview.initialHeight,
          minHeight: preview.minHeight,
          maxHeight: "none",
          resize: "vertical",
        }}
      >
        <div
          className="relative mx-auto"
          style={{
            width: scaledWidth,
            minWidth: scaledWidth,
            minHeight: scaledHeight,
          }}
        >
          <div
            className="absolute top-0"
            style={{
              left: (scaledWidth - preview.sourceWidth) / 2,
              width: preview.sourceWidth,
              transform: `scale(${scale})`,
              transformOrigin: "top center",
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsPrintPreviews({
  settings,
  logoSrc,
  stampSrc,
  watermarkSrc,
  isAR,
  invoicePreviewScale,
  receiptPreviewScale,
  statementPreviewScale,
}: {
  settings: CompanySettings;
  logoSrc: string;
  stampSrc: string;
  watermarkSrc: string;
  isAR: boolean;
  invoicePreviewScale: number;
  receiptPreviewScale: number;
  statementPreviewScale: number;
}) {
  const override = { settings, logoSrc, stampSrc, watermarkSrc };
  const receiverSignature = settings.receiverSignatureBase64;
  const today = formatDateYMD();

  return (
    <div className="w-full max-w-none space-y-4">
      <PreviewShell title={isAR ? "معاينة الفاتورة" : "Invoice Preview"} size="large" scale={invoicePreviewScale}>
        <div
          className="bg-white shadow-xl border border-gray-200 relative overflow-hidden"
          style={{ fontFamily: "'Cairo', 'Arial', sans-serif" }}
        >
          <PrintWatermark kind="invoice" override={override} />
          <div className="relative z-10">
            <InvoicePrintHeader
              company={settings}
              logoSrc={logoSrc}
              isAR={isAR}
              invoiceNumber="INV-PREVIEW"
              statusText={isAR ? "معاينة" : "Preview"}
            />
            <div className="border-b-2 border-gray-700" dir="ltr">
              {[
                ["Customer / العميل", isAR ? "عميل تجريبي" : "Sample Client", "Inv. Date", today],
                ["Sales Man / المندوب", isAR ? "المحاسب" : "Accountant", "B.L / M AWB", "BL-2026-001"],
                ["منفذ الدخول / Port", isAR ? "ميناء حمد" : "Hamad Port", "Weight / الوزن", "1,250 Kg"],
              ].map((row) => (
                <div key={row.join("-")} className="grid grid-cols-2 border-b border-dashed border-gray-200 last:border-b-0">
                  <div className="px-5 py-1.5 border-r border-dashed border-gray-200">
                    <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">{row[0]}</div>
                    <div className="text-[13px] leading-tight font-bold text-gray-900">{row[1]}</div>
                  </div>
                  <div className="px-5 py-1.5">
                    <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">{row[2]}</div>
                    <div className="text-[13px] leading-tight font-bold text-gray-900 font-mono">{row[3]}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-6 pt-3">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-y-2 border-gray-700">
                    <th className="text-right py-2 px-2 font-bold text-gray-700 w-10">#</th>
                    <th className="text-right py-2 px-3 font-bold text-gray-700">Description / الوصف</th>
                    <th className="text-center py-2 px-2 font-bold text-gray-700 w-16">الكمية</th>
                    <th className="text-center py-2 px-2 font-bold text-gray-700 w-24">سعر الوحدة</th>
                    <th className="text-left py-2 px-3 font-bold text-gray-700 w-32">Total Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-dashed border-gray-300">
                    <td className="py-2 px-2 text-gray-500 text-center font-mono text-xs">0001</td>
                    <td className="py-2 px-3 text-gray-800">{isAR ? "خدمة تخليص جمركي" : "Customs clearance service"}</td>
                    <td className="py-2 px-2 text-center text-gray-700">1</td>
                    <td className="py-2 px-2 text-center font-mono text-gray-700">1,250.00</td>
                    <td className="py-2 px-3 text-left font-mono font-bold text-gray-800">1,250.00</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="px-6 pb-2 pt-3">
              <div className="flex justify-between items-center border-t-2 border-double border-gray-700 pt-2">
                <span className="font-black text-base text-gray-800">الإجمالي الكلي / Grand Total</span>
                <span className="font-black font-mono text-base text-gray-900">1,250.00 QR</span>
              </div>
            </div>
            <PrintSignaturesStamp kind="invoice" receiverSignature={receiverSignature} override={override} />
            <PrintDocumentFooter kind="invoice" reference="INV-PREVIEW" override={override} />
          </div>
        </div>
      </PreviewShell>

      <div className="grid w-full grid-cols-1 xl:grid-cols-2 gap-4">
        <PreviewShell title={isAR ? "معاينة سند القبض" : "Receipt Preview"} size="medium" scale={receiptPreviewScale}>
          <div
            className="bg-white shadow-lg border border-gray-200 relative overflow-hidden"
            style={{ fontFamily: "'Cairo', 'Arial', sans-serif" }}
          >
            <PrintWatermark kind="receipt" override={override} />
            <ReceiptPrintHeader receiptNumber="RV-PREVIEW" override={override} />
            <div className="border-b border-gray-400 px-5 py-1.5 relative z-10">
              <table className="w-full text-xs border-collapse border border-gray-300">
                <tbody>
                  {[
                    ["العميل", isAR ? "عميل تجريبي" : "Sample Client", "Customer"],
                    ["طريقة الدفع", isAR ? "تحويل بنكي" : "Bank Transfer", "Payment Method"],
                    ["رقم الفاتورة", "INV-PREVIEW", "Invoice No"],
                    ["التاريخ", today, "Date"],
                  ].map((row) => (
                    <tr key={row[0]} className="border-b border-gray-200 last:border-b-0">
                      <td className="px-3 py-1.5 font-bold text-gray-700 text-right bg-gray-50 w-32 border-l border-gray-200">{row[0]}</td>
                      <td className="px-3 py-1.5 font-semibold text-gray-900 text-center border-l border-gray-200">{row[1]}</td>
                      <td className="px-3 py-1.5 font-bold text-gray-400 text-left bg-gray-50 w-32 tracking-wide">{row[2]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-2 relative z-10">
              <table className="w-full text-sm border-collapse border border-gray-700">
                <thead>
                  <tr className="border-b-2 border-gray-700 bg-gray-100">
                    <th className="text-right py-1.5 px-3 font-bold text-gray-700">البيان / Description</th>
                    <th className="text-left py-1.5 px-3 font-bold text-gray-700 w-36 border-r border-gray-700">QR</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="py-2.5 px-3 text-right font-medium text-gray-800">استلام مبلغ مقابل INV-PREVIEW</td>
                    <td className="py-2.5 px-3 text-left font-mono font-bold text-gray-800 border-r border-gray-300">1,250.00</td>
                  </tr>
                </tbody>
              </table>
              <div className="flex justify-between items-center border-t-2 border-double border-gray-700 pt-1.5">
                <span className="font-black text-sm text-gray-800">Grand Total / الإجمالي الكلي</span>
                <span className="font-black font-mono text-lg text-gray-900">1,250.00 QR</span>
              </div>
            </div>
            <PrintSignaturesStamp kind="receipt" receiverSignature={receiverSignature} receiverName={isAR ? "المستلم" : "Receiver"} override={override} />
            <PrintDocumentFooter kind="receipt" reference="RV-PREVIEW" override={override} />
          </div>
        </PreviewShell>

        <PreviewShell title={isAR ? "معاينة كشف الحساب" : "Customer Statement Preview"} size="small" scale={statementPreviewScale}>
          <div
            className="bg-white shadow-xl border border-gray-200 relative overflow-hidden"
            style={{ fontFamily: "'Cairo', 'Arial', sans-serif" }}
          >
            <PrintWatermark kind="statement" override={override} />
            <StatementPrintHeader
              statementRef="CL-PREVIEW-2026"
              dateText={today}
              titleAr={settings.statementTitleAr}
              titleEn={settings.statementTitleEn}
              titleFontSize={settings.statementTitleFontSize}
              titleVisible={settings.statementTitleVisible}
              titleAlign={settings.statementTitleAlign}
              titleBold={settings.statementTitleBold}
              subtitleAr={settings.statementSubtitleAr}
              subtitleEn={settings.statementSubtitleEn}
              subtitleFontSize={settings.statementSubtitleFontSize}
              override={override}
            />
            <div className="px-6 py-3 border-b border-gray-300 relative z-10">
              <div className="grid grid-cols-2 gap-6">
                <div className="text-right">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">بيانات العميل / CLIENT DETAILS</p>
                  <p className="text-base font-black text-gray-900">{isAR ? "عميل تجريبي" : "Sample Client"}</p>
                  <p className="text-sm text-gray-600 mt-0.5">{isAR ? "الدوحة، قطر" : "Doha, Qatar"}</p>
                </div>
                <div className="border-2 border-gray-700 rounded text-sm">
                  <div className="bg-gray-800 text-white text-center py-1 font-bold text-xs uppercase tracking-widest">ملخص الحساب / ACCOUNT SUMMARY</div>
                  <div className="divide-y divide-gray-200">
                    <div className="flex justify-between px-4 py-1.5"><span>إجمالي المدين / Total Debit</span><span className="font-mono font-bold">QR 4,750.00</span></div>
                    <div className="flex justify-between px-4 py-1.5"><span>إجمالي الدائن / Total Credit</span><span className="font-mono font-bold text-green-700">QR 1,250.00</span></div>
                    <div className="flex justify-between px-4 py-2 bg-gray-50"><span className="font-black">الرصيد / Balance</span><span className="font-mono font-black text-red-700">QR 3,500.00</span></div>
                  </div>
                </div>
              </div>
            </div>
            <div className="px-6 pt-4 relative z-10">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-y-2 border-gray-700 bg-gray-100">
                    <th className="text-right py-2 px-2 font-bold text-gray-700 w-10">#</th>
                    <th className="text-right py-2 px-3 font-bold text-gray-700">التاريخ / Date</th>
                    <th className="text-right py-2 px-3 font-bold text-gray-700">البيان / Description</th>
                    <th className="text-left py-2 px-2 font-bold text-gray-700 w-24">مدين / Debit</th>
                    <th className="text-left py-2 px-2 font-bold text-green-700 w-24">دائن / Credit</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-dashed border-gray-300">
                    <td className="py-2 px-2 text-center font-mono text-xs">001</td>
                    <td className="py-2 px-3">{today}</td>
                    <td className="py-2 px-3 font-semibold">فاتورة رقم INV-PREVIEW</td>
                    <td className="py-2 px-2 text-left font-mono font-bold">4,750.00</td>
                    <td className="py-2 px-2 text-left font-mono text-gray-300">—</td>
                  </tr>
                  <tr className="border-b border-dashed border-gray-300">
                    <td className="py-2 px-2 text-center font-mono text-xs">002</td>
                    <td className="py-2 px-3">{today}</td>
                    <td className="py-2 px-3 font-semibold">سند قبض RV-PREVIEW</td>
                    <td className="py-2 px-2 text-left font-mono text-gray-300">—</td>
                    <td className="py-2 px-2 text-left font-mono font-bold text-green-700">1,250.00</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="relative px-6 pb-3 pt-4 z-10">
              <StatementStamp override={override} />
            </div>
            <PrintDocumentFooter kind="statement" reference="CL-PREVIEW-2026" count={2} override={override} />
          </div>
        </PreviewShell>

        <PreviewShell title={isAR ? "معاينة ملخص العميل المالي" : "Customer Financial Summary Preview"} size="small" scale={statementPreviewScale}>
          <div
            className="bg-white shadow-xl border border-gray-200 relative overflow-hidden"
            style={{ fontFamily: "'Cairo', 'Arial', sans-serif" }}
          >
            <PrintWatermark kind="statement" override={override} />
            <StatementPrintHeader
              statementRef="CL-SUMMARY-2026"
              dateText={today}
              titleAr={settings.customerLedgerTitleAr}
              titleEn={settings.customerLedgerTitleEn}
              titleFontSize={settings.customerLedgerTitleFontSize}
              titleVisible={settings.customerLedgerTitleVisible}
              titleAlign={settings.customerLedgerTitleAlign}
              titleBold={settings.customerLedgerTitleBold}
              subtitleAr={settings.customerLedgerSubtitleAr}
              subtitleEn={settings.customerLedgerSubtitleEn}
              subtitleFontSize={settings.customerLedgerSubtitleFontSize}
              override={override}
            />
            <div className="px-6 py-3 border-b border-gray-300 relative z-10">
              <div className="grid grid-cols-2 gap-6">
                <div className="text-right">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">بيانات العميل / CLIENT DETAILS</p>
                  <p className="text-base font-black text-gray-900">{isAR ? "عميل تجريبي" : "Sample Client"}</p>
                  <p className="text-sm text-gray-600 mt-0.5">{isAR ? "الدوحة، قطر" : "Doha, Qatar"}</p>
                </div>
                <div className="border-2 border-gray-700 rounded text-sm">
                  <div className="bg-gray-800 text-white text-center py-1 font-bold text-xs uppercase tracking-widest">ملخص الحساب / ACCOUNT SUMMARY</div>
                  <div className="divide-y divide-gray-200">
                    <div className="flex justify-between px-4 py-1.5"><span>إجمالي المدين / Total Debit</span><span className="font-mono font-bold">QR 4,750.00</span></div>
                    <div className="flex justify-between px-4 py-1.5"><span>إجمالي الدائن / Total Credit</span><span className="font-mono font-bold text-green-700">QR 1,250.00</span></div>
                    <div className="flex justify-between px-4 py-2 bg-gray-50"><span className="font-black">الرصيد / Balance</span><span className="font-mono font-black text-red-700">QR 3,500.00</span></div>
                  </div>
                </div>
              </div>
            </div>
            <div className="px-6 pt-4 relative z-10">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-y-2 border-gray-700 bg-gray-100">
                    <th className="text-right py-2 px-2 font-bold text-gray-700 w-10">#</th>
                    <th className="text-right py-2 px-3 font-bold text-gray-700">التاريخ / Date</th>
                    <th className="text-right py-2 px-3 font-bold text-gray-700">البيان / Description</th>
                    <th className="text-left py-2 px-2 font-bold text-gray-700 w-24">مدين / Debit</th>
                    <th className="text-left py-2 px-2 font-bold text-green-700 w-24">دائن / Credit</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-dashed border-gray-300">
                    <td className="py-2 px-2 text-center font-mono text-xs">001</td>
                    <td className="py-2 px-3">{today}</td>
                    <td className="py-2 px-3 font-semibold">فاتورة رقم INV-PREVIEW</td>
                    <td className="py-2 px-2 text-left font-mono font-bold">4,750.00</td>
                    <td className="py-2 px-2 text-left font-mono text-gray-300">-</td>
                  </tr>
                  <tr className="border-b border-dashed border-gray-300">
                    <td className="py-2 px-2 text-center font-mono text-xs">002</td>
                    <td className="py-2 px-3">{today}</td>
                    <td className="py-2 px-3 font-semibold">سند قبض RV-PREVIEW</td>
                    <td className="py-2 px-2 text-left font-mono text-gray-300">-</td>
                    <td className="py-2 px-2 text-left font-mono font-bold text-green-700">1,250.00</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <PrintDocumentFooter kind="statement" reference="CL-SUMMARY-2026" count={2} override={override} />
          </div>
        </PreviewShell>
      </div>
    </div>
  );
}

function PreviewScaleControl({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="min-w-0 space-y-1">
      <div className="flex items-center justify-between gap-3 text-xs font-semibold text-muted-foreground">
        <span>{label}</span>
        <span className="font-mono text-foreground">{Math.round(value * 100)}%</span>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={min}
          max={max}
          step={0.02}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full accent-primary"
        />
        <input
          type="number"
          min={Math.round(min * 100)}
          max={Math.round(max * 100)}
          step={2}
          value={Math.round(value * 100)}
          onChange={(e) => {
            const next = (Number(e.target.value) || Math.round(min * 100)) / 100;
            onChange(Math.min(max, Math.max(min, next)));
          }}
          className="h-8 w-20 rounded-md border border-border bg-background px-2 text-xs font-mono outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>
    </label>
  );
}

function DatabaseSyncPanel({
  isAR,
  databaseMode,
  setDatabaseMode,
  databaseConfig,
  setDatabaseConfig,
  syncConfig,
  setSyncConfig,
}: {
  isAR: boolean;
  databaseMode: DatabaseMode;
  setDatabaseMode: (mode: DatabaseMode) => void;
  databaseConfig: {
    localPath: string;
    connectionStatus: string;
    host: string;
    port: string;
    databaseName: string;
    username: string;
    password: string;
    useConnectionString: boolean;
    connectionString: string;
  };
  setDatabaseConfig: React.Dispatch<React.SetStateAction<{
    localPath: string;
    connectionStatus: string;
    host: string;
    port: string;
    databaseName: string;
    username: string;
    password: string;
    useConnectionString: boolean;
    connectionString: string;
  }>>;
  syncConfig: {
    mode: SyncMode;
    autoSync: boolean;
    timing: AutoSyncTiming;
    intervalMinutes: number;
    lastSyncTime: string;
    status: SyncStatus;
  };
  setSyncConfig: React.Dispatch<React.SetStateAction<{
    mode: SyncMode;
    autoSync: boolean;
    timing: AutoSyncTiming;
    intervalMinutes: number;
    lastSyncTime: string;
    status: SyncStatus;
  }>>;
}) {
  return (
    <div className="space-y-4" dir={isAR ? "rtl" : "ltr"}>
      <div className={`${isAR ? "text-right" : "text-left"}`}>
        <h3 className="text-sm font-bold text-foreground">
          {isAR ? "قاعدة البيانات والمزامنة" : "Database & Sync"}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {isAR
            ? "واجهة مبدئية لاختيار مصدر قاعدة البيانات وتجهيز إعدادات المزامنة بدون تنفيذ اتصال فعلي حاليًا."
            : "Feature-ready controls for choosing a database source and preparing sync settings without running real connections yet."}
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
        <div className="mb-4 flex items-center gap-2 text-sm font-bold text-foreground">
          <Database className="h-4 w-4 text-primary" />
          <span>{isAR ? "نوع قاعدة البيانات" : "Database Type"}</span>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {[
            { id: "local" as DatabaseMode, icon: Database, labelAr: "قاعدة محلية (SQLite)", labelEn: "Local Database (SQLite)" },
            { id: "online" as DatabaseMode, icon: Cloud, labelAr: "قاعدة أونلاين (PostgreSQL / MySQL لاحقًا)", labelEn: "Online Database (PostgreSQL / MySQL later)" },
          ].map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setDatabaseMode(option.id)}
              className={cn(
                "flex items-center gap-3 rounded-xl border p-3 text-sm transition",
                databaseMode === option.id
                  ? "border-primary bg-primary/5 text-primary shadow-sm"
                  : "border-border bg-background hover:border-primary/40"
              )}
            >
              <option.icon className="h-4 w-4 shrink-0" />
              <span className="font-semibold">{isAR ? option.labelAr : option.labelEn}</span>
            </button>
          ))}
        </div>
      </div>

      {databaseMode === "local" && (
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
          <div className="mb-4 flex items-center gap-2 text-sm font-bold text-foreground">
            <Database className="h-4 w-4 text-emerald-600" />
            <span>{isAR ? "قاعدة البيانات المحلية" : "Local Database"}</span>
          </div>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <Field label={isAR ? "مسار قاعدة البيانات" : "Database Path"}>
              <input
                value={databaseConfig.localPath}
                onChange={(e) => setDatabaseConfig((p) => ({ ...p, localPath: e.target.value }))}
                className={inp}
              />
            </Field>
            <Field label={isAR ? "حالة الاتصال" : "Connection Status"}>
              <div className="flex h-10 items-center justify-between rounded-xl border border-border bg-background px-3 text-sm">
                <span className={cn("font-semibold", databaseConfig.connectionStatus === "Connected" ? "text-emerald-600" : "text-red-600")}>
                  {databaseConfig.connectionStatus === "Connected" ? (isAR ? "متصل" : "Connected") : (isAR ? "غير متصل" : "Not Connected")}
                </span>
                <span className={cn("h-2.5 w-2.5 rounded-full", databaseConfig.connectionStatus === "Connected" ? "bg-emerald-500" : "bg-red-500")} />
              </div>
            </Field>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="h-9 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90">
              {isAR ? "إنشاء قاعدة جديدة" : "Generate New Database"}
            </button>
            <button type="button" className="h-9 rounded-lg border border-border bg-background px-3 text-xs font-semibold hover:bg-muted">
              {isAR ? "تحميل ملف SQL لإنشاء قاعدة جديدة" : "Upload SQL File"}
            </button>
          </div>
        </div>
      )}

      {databaseMode === "online" && (
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
          <div className="mb-4 flex items-center gap-2 text-sm font-bold text-foreground">
            <Cloud className="h-4 w-4 text-blue-600" />
            <span>{isAR ? "إعدادات قاعدة البيانات الأونلاين" : "Online Database Settings"}</span>
          </div>
          <label className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
            <input
              type="checkbox"
              checked={databaseConfig.useConnectionString}
              onChange={(e) => setDatabaseConfig((p) => ({ ...p, useConnectionString: e.target.checked }))}
              className="h-4 w-4 accent-primary"
            />
            <span>{isAR ? "استخدام Connection String كامل" : "Use full Connection String"}</span>
          </label>

          {databaseConfig.useConnectionString ? (
            <Field label="Connection String">
              <input
                type="password"
                value={databaseConfig.connectionString}
                onChange={(e) => setDatabaseConfig((p) => ({ ...p, connectionString: e.target.value }))}
                placeholder="postgresql://user:password@host:5432/database"
                dir="ltr"
                className={inp}
              />
            </Field>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              <Field label="Host">
                <input value={databaseConfig.host} onChange={(e) => setDatabaseConfig((p) => ({ ...p, host: e.target.value }))} className={inp} dir="ltr" />
              </Field>
              <Field label="Port">
                <input value={databaseConfig.port} onChange={(e) => setDatabaseConfig((p) => ({ ...p, port: e.target.value }))} className={inp} dir="ltr" />
              </Field>
              <Field label={isAR ? "اسم قاعدة البيانات" : "Database Name"}>
                <input value={databaseConfig.databaseName} onChange={(e) => setDatabaseConfig((p) => ({ ...p, databaseName: e.target.value }))} className={inp} dir="ltr" />
              </Field>
              <Field label={isAR ? "اسم المستخدم" : "Username"}>
                <input value={databaseConfig.username} onChange={(e) => setDatabaseConfig((p) => ({ ...p, username: e.target.value }))} className={inp} dir="ltr" />
              </Field>
              <Field label={isAR ? "كلمة المرور" : "Password"}>
                <input type="password" value={databaseConfig.password} onChange={(e) => setDatabaseConfig((p) => ({ ...p, password: e.target.value }))} className={inp} dir="ltr" />
              </Field>
            </div>
          )}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
        <div className="mb-4 flex flex-wrap gap-2">
          <button type="button" className="h-9 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-semibold text-blue-700 hover:bg-blue-100">
            {isAR ? "اختبار الاتصال" : "Test Connection"}
          </button>
          <button type="button" className="h-9 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 hover:bg-emerald-100">
            {isAR ? "حفظ الإعدادات" : "Save Configuration"}
          </button>
          <button type="button" className="h-9 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90">
            {isAR ? "اتصال" : "Connect"}
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div>
            <div className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground">
              <RefreshCw className="h-4 w-4 text-primary" />
              <span>{isAR ? "خيارات المزامنة" : "Sync Options"}</span>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {[
                { id: "local-to-online" as SyncMode, labelAr: "مزامنة المحلي إلى الأونلاين", labelEn: "Sync Local -> Online" },
                { id: "online-to-local" as SyncMode, labelAr: "مزامنة الأونلاين إلى المحلي", labelEn: "Sync Online -> Local" },
                { id: "bidirectional" as SyncMode, labelAr: "مزامنة ثنائية الاتجاه", labelEn: "Sync Both (Bidirectional)" },
              ].map((mode) => (
                <label key={mode.id} className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm">
                  <input
                    type="radio"
                    checked={syncConfig.mode === mode.id}
                    onChange={() => setSyncConfig((p) => ({ ...p, mode: mode.id }))}
                    className="h-4 w-4 accent-primary"
                  />
                  <span>{isAR ? mode.labelAr : mode.labelEn}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground">
              <SlidersHorizontal className="h-4 w-4 text-primary" />
              <span>{isAR ? "التحكم في المزامنة" : "Sync Control"}</span>
            </div>
            <div className="space-y-3 rounded-xl border border-border bg-background p-3">
              <label className="flex items-center justify-between gap-3 text-sm font-semibold">
                <span>{isAR ? "تشغيل تلقائي" : "Auto Sync"}</span>
                <button type="button" onClick={() => setSyncConfig((p) => ({ ...p, autoSync: !p.autoSync }))} className={tog(syncConfig.autoSync)}>
                  <span className={`absolute top-0.5 left-0.5 h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${syncConfig.autoSync ? "translate-x-5" : ""}`} />
                </button>
              </label>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" checked={syncConfig.timing === "startup"} onChange={() => setSyncConfig((p) => ({ ...p, timing: "startup" }))} className="h-4 w-4 accent-primary" />
                  <span>{isAR ? "عند فتح البرنامج" : "Every app start"}</span>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" checked={syncConfig.timing === "interval"} onChange={() => setSyncConfig((p) => ({ ...p, timing: "interval" }))} className="h-4 w-4 accent-primary" />
                  <span>{isAR ? "كل X دقيقة" : "Every X minutes"}</span>
                </label>
              </div>
              <Field label={isAR ? "الفاصل بالدقائق" : "Interval Minutes"}>
                <input
                  type="number"
                  min={1}
                  value={syncConfig.intervalMinutes}
                  onChange={(e) => setSyncConfig((p) => ({ ...p, intervalMinutes: Math.max(1, Number(e.target.value) || 1) }))}
                  className={inp}
                />
              </Field>
              <button type="button" className="h-9 w-full rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90">
                {isAR ? "بدء المزامنة" : "Start Sync"}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-border bg-background p-3">
            <div className="text-xs font-semibold uppercase text-muted-foreground">{isAR ? "آخر مزامنة" : "Last Sync Time"}</div>
            <div className="mt-1 font-mono text-sm text-foreground">{syncConfig.lastSyncTime}</div>
          </div>
          <div className="rounded-xl border border-border bg-background p-3">
            <div className="text-xs font-semibold uppercase text-muted-foreground">{isAR ? "الحالة" : "Status"}</div>
            <div className="mt-1 text-sm font-bold text-muted-foreground">
              {syncConfig.status === "success" && (isAR ? "نجاح" : "Success")}
              {syncConfig.status === "failed" && (isAR ? "فشل" : "Failed")}
              {syncConfig.status === "in-progress" && (isAR ? "قيد التنفيذ" : "In Progress")}
              {syncConfig.status === "idle" && (isAR ? "جاهز" : "Ready")}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const inp = "w-full px-3 py-2 text-sm bg-background border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary/20 transition-colors";
const tog = (on: boolean) =>
  `relative w-11 h-6 rounded-full transition-colors cursor-pointer ${on ? "bg-primary" : "bg-muted-foreground/30"}`;

export default function SettingsPage() {
  const { user } = useAuth();
  const { lang, isRTL } = useLanguage();
  const isAR = lang === "ar";
  const { display, update: updateDisplay } = useDisplaySettings();
  const { settings, refresh, setSettings, logoSrc, stampSrc, watermarkSrc } = useCompanySettings();
  const { toast } = useToast();
  const [form, setForm] = useState<any>({ masterPassword: "", ...DEFAULT_SETTINGS });
  const [saving, setSaving] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [stampPreview, setStampPreview] = useState<string | null>(null);
  const [watermarkPreview, setWatermarkPreview] = useState<string | null>(null);
  const [accountantSignaturePreview, setAccountantSignaturePreview] = useState<string | null>(null);
  const [receiverSignaturePreview, setReceiverSignaturePreview] = useState<string | null>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const accountantSignatureRef = useRef<HTMLInputElement>(null);
  const receiverSignatureRef = useRef<HTMLInputElement>(null);
  const stampRef = useRef<HTMLInputElement>(null);
  const watermarkRef = useRef<HTMLInputElement>(null);
  const [allowManagerEditAccountantSignature, setAllowManagerEditAccountantSignature] = useState(false);
  const [allowManagerEditAppearance, setAllowManagerEditAppearance] = useState(false);
  const [allowManagerEditInvoicesBackupImport, setAllowManagerEditInvoicesBackupImport] = useState(false);
  const [allowManagerEditLegalInfo, setAllowManagerEditLegalInfo] = useState(false);
  const [allowManagerEditPrintSettings, setAllowManagerEditPrintSettings] = useState(false);
  const [allowManagerEditBranding, setAllowManagerEditBranding] = useState(false);
  const [allowManagerViewPreview, setAllowManagerViewPreview] = useState(false);
  const [allowManagerViewUpdate, setAllowManagerViewUpdate] = useState(false);
  const [allowManagerEditRegistrationSettings, setAllowManagerEditRegistrationSettings] = useState(false);
  const [allowManagerEditSensitiveUsers, setAllowManagerEditSensitiveUsers] = useState(false);
  const [lockCompanyIdentity, setLockCompanyIdentity] = useState(false);
  const [lockCompanyName, setLockCompanyName] = useState(false);
  const [lockLogo, setLockLogo] = useState(false);
  const [lockStamp, setLockStamp] = useState(false);
  const [lockLegalInfo, setLockLegalInfo] = useState(false);
  const [lockFooterBranding, setLockFooterBranding] = useState(false);
  const developerUnlocked = sessionStorage.getItem("developer_unlocked") === "true";
  const roleCanEdit = user?.role === "admin";
  const canEditAccountantSignature = roleCanEdit || allowManagerEditAccountantSignature;
  const canEditAppearance = true;
  const canEditBranding = (roleCanEdit || allowManagerEditBranding || allowManagerEditAppearance) && !lockCompanyIdentity;
  const canEditCompanyName = canEditBranding && !lockCompanyName;
  const canEditLogo = canEditBranding && !lockLogo;
  const canEditStamp = canEditBranding && !lockStamp;
  const canEditLegalInfo = (roleCanEdit || allowManagerEditLegalInfo) && !lockLegalInfo;
  const canEditPrintSettings = (roleCanEdit || allowManagerEditPrintSettings) && !lockFooterBranding;
  const canEditBrandIdentity = canEditBranding;
  const canUseInvoicesBackupImport = roleCanEdit || allowManagerEditInvoicesBackupImport;
  const [activeTab, setActiveTab] = useState<TabId>("preview");
  const [invoicePreviewScale, setInvoicePreviewScale] = useState(0.76);
  const [receiptPreviewScale, setReceiptPreviewScale] = useState(0.8);
  const [statementPreviewScale, setStatementPreviewScale] = useState(0.78);
  const [backupPassword, setBackupPassword] = useState("");
  const [importPassword, setImportPassword] = useState("");
  const [backupView, setBackupView] = useState<BackupView>("backup-import");
  const [databaseMode, setDatabaseMode] = useState<DatabaseMode>("local");
  const [databaseConfig, setDatabaseConfig] = useState({
    localPath: "lib/db/local.db",
    connectionStatus: "Connected",
    host: "",
    port: "5432",
    databaseName: "",
    username: "",
    password: "",
    useConnectionString: false,
    connectionString: "",
  });
  const [syncConfig, setSyncConfig] = useState<{
    mode: SyncMode;
    autoSync: boolean;
    timing: AutoSyncTiming;
    intervalMinutes: number;
    lastSyncTime: string;
    status: SyncStatus;
  }>({
    mode: "local-to-online",
    autoSync: false,
    timing: "startup",
    intervalMinutes: 15,
    lastSyncTime: "-",
    status: "idle",
  });
  const [updateStatus, setUpdateStatus] = useState(isAR ? "جاهز" : "Ready");
  const [updateVersion, setUpdateVersion] = useState("");
  const [updateProgress, setUpdateProgress] = useState(0);
  const [updateReady, setUpdateReady] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [showBackupPassword, setShowBackupPassword] = useState(false);
  const [showImportPassword, setShowImportPassword] = useState(false);
  const [showMasterPassword, setShowMasterPassword] = useState(false);
  const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const bufferToBase64 = (buffer: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buffer)));

const base64ToBuffer = (base64: string) =>
  Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

  useEffect(() => {
    const api = (window as any).electronAPI;
    if (!api?.onUpdateStatus) return;

    const off = api.onUpdateStatus(({ channel, payload }: { channel: string; payload?: any }) => {
      if (channel === "update-checking") {
        setCheckingUpdate(true);
        setUpdateReady(false);
        setUpdateProgress(0);
        setUpdateStatus(isAR ? "جاري البحث عن تحديث..." : "Checking for updates...");
      }

      if (channel === "update-available") {
        setCheckingUpdate(false);
        setUpdateReady(false);
        setUpdateVersion(payload?.version || "");
        setUpdateStatus(isAR ? "يوجد تحديث جديد، جاهز للتحميل." : "Update available, ready to download.");
      }

      if (channel === "update-not-available") {
        setCheckingUpdate(false);
        setUpdateReady(false);
        setUpdateProgress(0);
        setUpdateVersion(payload?.version || "");
        setUpdateStatus(isAR ? "لا توجد تحديثات جديدة." : "No updates available.");
      }

      if (channel === "update-download-progress") {
        const percent = Math.round(Number(payload?.percent || 0));
        setUpdateProgress(percent);
        setUpdateStatus(isAR ? `جاري تحميل التحديث ${percent}%` : `Downloading update ${percent}%`);
      }

      if (channel === "update-downloaded") {
        setCheckingUpdate(false);
        setUpdateReady(true);
        setUpdateProgress(100);
        setUpdateVersion(payload?.version || "");
        setUpdateStatus(isAR ? "تم تحميل التحديث. يمكن تثبيته الآن." : "Update downloaded. Ready to install.");
      }

      if (channel === "update-error") {
        setCheckingUpdate(false);
        setUpdateStatus(payload?.message || (isAR ? "فشل التحديث." : "Update failed."));
      }
    });

    return () => off?.();
  }, [isAR]);

const deriveBackupKey = async (password: string, salt: Uint8Array) => {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
};

const encryptBackupData = async (data: unknown, password: string) => {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveBackupKey(password, salt);

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    textEncoder.encode(JSON.stringify(data))
  );

  return {
    version: 1,
    encrypted: true,
    algorithm: "AES-GCM",
    kdf: "PBKDF2-SHA256",
    iterations: 100000,
    salt: bufferToBase64(salt.buffer),
    iv: bufferToBase64(iv.buffer),
    data: bufferToBase64(encrypted),
  };
};

const decryptBackupData = async (backupFile: any, password: string) => {
  const salt = base64ToBuffer(backupFile.salt);
  const iv = base64ToBuffer(backupFile.iv);
  const encryptedData = base64ToBuffer(backupFile.data);

  const key = await deriveBackupKey(password, salt);

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    encryptedData
  );

  return JSON.parse(textDecoder.decode(decrypted));
};

  useEffect(() => {
    setForm({ ...DEFAULT_SETTINGS, ...settings });
    setLogoPreview(settings.logoBase64 || null);
    setStampPreview(settings.stampBase64 || null);
    setWatermarkPreview(settings.watermarkBase64 || null);
    setAccountantSignaturePreview(settings.accountantSignatureBase64 || null);
    setReceiverSignaturePreview(settings.receiverSignatureBase64 || null);
  }, [settings]);

  useEffect(() => {
    const token = sessionStorage.getItem("auth_token");

    const applyDeveloperSettings = (data: any) => {
        setAllowManagerEditAccountantSignature(!!data.allowManagerEditAccountantSignature);
        setAllowManagerEditAppearance(!!data.allowManagerEditAppearance);
        setAllowManagerEditInvoicesBackupImport(!!data.allowManagerEditInvoicesBackupImport);
        setAllowManagerEditLegalInfo(!!data.allowManagerEditLegalInfo);
        setAllowManagerEditPrintSettings(!!data.allowManagerEditPrintSettings);
        setAllowManagerEditBranding(!!data.allowManagerEditBranding);
        setAllowManagerViewPreview(!!data.allowManagerViewPreview);
        setAllowManagerViewUpdate(!!data.allowManagerViewUpdate);
        setAllowManagerEditRegistrationSettings(!!data.allowManagerEditRegistrationSettings);
        setAllowManagerEditSensitiveUsers(!!data.allowManagerEditSensitiveUsers);
        setLockCompanyIdentity(!!data.lockCompanyIdentity);
        setLockCompanyName(!!data.lockCompanyName);
        setLockLogo(!!data.lockLogo);
        setLockStamp(!!data.lockStamp);
        setLockLegalInfo(!!data.lockLegalInfo);
        setLockFooterBranding(!!data.lockFooterBranding);
    };

    const cached = sessionStorage.getItem("developer_settings");
    if (cached) {
      try {
        applyDeveloperSettings(JSON.parse(cached));
      } catch {
        sessionStorage.removeItem("developer_settings");
      }
    }

    fetch(`${API_BASE}/developer/settings?t=${Date.now()}`, {
      cache: "no-store",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        "Cache-Control": "no-cache",
      },
    })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        sessionStorage.setItem("developer_settings", JSON.stringify(data));
        applyDeveloperSettings(data);
      })
      .catch(() => {
        setAllowManagerEditAccountantSignature(false);
        setAllowManagerEditAppearance(false);
        setAllowManagerEditInvoicesBackupImport(false);
        setAllowManagerEditLegalInfo(false);
        setAllowManagerEditPrintSettings(false);
        setAllowManagerEditBranding(false);
        setAllowManagerViewPreview(false);
        setAllowManagerViewUpdate(false);
        setAllowManagerEditRegistrationSettings(false);
        setAllowManagerEditSensitiveUsers(false);
        setLockCompanyIdentity(false);
        setLockCompanyName(false);
        setLockLogo(false);
        setLockStamp(false);
        setLockLegalInfo(false);
        setLockFooterBranding(false);
      });

    const handler = (event: Event) => {
      if (event instanceof StorageEvent) {
        if (event.key !== "developer_settings" || !event.newValue) return;
        applyDeveloperSettings(JSON.parse(event.newValue));
        return;
      }
      applyDeveloperSettings((event as CustomEvent).detail || {});
    };
    window.addEventListener("developer-settings-updated", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("developer-settings-updated", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  // Export invoices backup
  const exportInvoices = async () => {
    if (!canUseInvoicesBackupImport) {
      alert(isAR ? "غير مسموح بتصدير الفواتير" : "Invoices export is not allowed");
      return;
    }

    try {
      const token = sessionStorage.getItem("auth_token");

      const res = await fetch("http://127.0.0.1:3000/api/invoices", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        alert(isAR ? "فشل الاتصال بالفواتير" : "Failed to connect invoices");
        return;
      }

      const invoices = await res.json();

      const invoicesWithItems = await Promise.all(
        invoices.map(async (invoice: any) => {
          const detailRes = await fetch(`http://127.0.0.1:3000/api/invoices/${invoice.id}`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          if (!detailRes.ok) {
            return invoice;
          }

          return await detailRes.json();
        })
      );

      const blob = new Blob([JSON.stringify(invoicesWithItems, null, 2)], {
        type: "application/json",
      });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");

      a.href = url;
      a.download = "invoices-backup.json";
      document.body.appendChild(a);
      a.click();
      a.remove();

      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert(isAR ? "حدث خطأ أثناء التصدير" : "Export error");
    }
  };

  // Export receipts backup
  const exportReceipts = async () => {
    try {
      const token = sessionStorage.getItem("auth_token");

      const res = await fetch("http://127.0.0.1:3000/api/receipts", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        alert(isAR ? "فشل الاتصال بسندات القبض" : "Failed to connect receipts");
        return;
      }

      const data = await res.json();

      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");

      a.href = url;
      a.download = "receipts-backup.json";
      document.body.appendChild(a);
      a.click();
      a.remove();

      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert(isAR ? "حدث خطأ أثناء التصدير" : "Export error");
    }
  };
    // Export clients backup
    const exportClients = async () => {
      try {
        const token = sessionStorage.getItem("auth_token");

        const res = await fetch("http://127.0.0.1:3000/api/clients", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          alert(isAR ? "فشل الاتصال بالعملاء" : "Failed to connect clients");
          return;
        }

        const data = await res.json();

        const blob = new Blob([JSON.stringify(data, null, 2)], {
          type: "application/json",
        });

        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");

        a.href = url;
        a.download = "clients-backup.json";
        document.body.appendChild(a);
        a.click();
        a.remove();

        window.URL.revokeObjectURL(url);
      } catch (err) {
        console.error(err);
        alert(isAR ? "حدث خطأ أثناء التصدير" : "Export error");
      }
    };
      // Export items backup
    const exportItems = async () => {
      try {
        const token = sessionStorage.getItem("auth_token");

        const res = await fetch("http://127.0.0.1:3000/api/invoice-item-templates", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          alert(isAR ? "فشل الاتصال بالبـنود" : "Failed to connect items");
          return;
        }

        const data = await res.json();

        const blob = new Blob([JSON.stringify(data, null, 2)], {
          type: "application/json",
        });

        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");

        a.href = url;
        a.download = "items-backup.json";
        document.body.appendChild(a);
        a.click();
        a.remove();

        window.URL.revokeObjectURL(url);
      } catch (err) {
        console.error(err);
        alert(isAR ? "حدث خطأ أثناء التصدير" : "Export error");
      }
    };

    // Import invoices backup
    const importInvoices = async (file: File, options: { bypassDeveloperPermission?: boolean } = {}) => {
      if (!options.bypassDeveloperPermission && !canUseInvoicesBackupImport) {
        alert(isAR ? "غير مسموح باستيراد الفواتير" : "Invoices import is not allowed");
        return;
      }

      const token = sessionStorage.getItem("auth_token");
      const data = JSON.parse(await file.text());

      const res = await fetch("http://127.0.0.1:3000/api/invoices/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ data }),
      });

      alert("تم استيراد الفواتير بنجاح");
      if (!res.ok) {
        alert(isAR ? "فشل استيراد الفواتير" : "Failed to import invoices");
        return;
      }
    };

    // Import receipts backup
    const importReceipts = async (file: File) => {
      const token = sessionStorage.getItem("auth_token");
      const data = JSON.parse(await file.text());

      const res = await fetch("http://127.0.0.1:3000/api/receipts/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ data }),
      });

      if (!res.ok) {
        alert(isAR ? "فشل استيراد السندات" : "Failed to import receipts");
        return;
      }

      alert(isAR ? "تم استيراد السندات بنجاح" : "Receipts imported successfully");
          };

    // Import clients backup
    const importClients = async (file: File) => {
      const token = sessionStorage.getItem("auth_token");
      const data = JSON.parse(await file.text());

      const res = await fetch("http://127.0.0.1:3000/api/clients/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ data }),
      });

      if (!res.ok) {
        alert(isAR ? "فشل استيراد العملاء" : "Failed to import clients");
        return;
      }
    };

    // Import items backup
    const importItems = async (file: File) => {
      const token = sessionStorage.getItem("auth_token");
      const data = JSON.parse(await file.text());

      const res = await fetch("http://127.0.0.1:3000/api/invoice-item-templates/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ data }),
      });

      if (!res.ok) {
        alert(isAR ? "فشل استيراد البنود" : "Failed to import items");
        return;
      }
    };


  if (!["admin", "manager", "supervisor"].includes(user?.role || "")) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-muted-foreground">
        <Shield className="w-16 h-16 opacity-20" />
        <p className="text-lg font-semibold">{isAR ? "هذه الصفحة للمدير فقط" : "Admin access only"}</p>
      </div>
    );
  }

  const handleImageUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    field:
      | "logoBase64"
      | "stampBase64"
      | "watermarkBase64"
      | "accountantSignatureBase64"
      | "receiverSignatureBase64",
    setPreview: (v: string | null) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: isAR ? "الحجم كبير جداً (2 MB كحد أقصى)" : "File too large (max 2 MB)", variant: "destructive" });
      return;
    }
    compressImageToDataUrl(file, {
      maxWidth: field === "watermarkBase64" ? 1600 : 1200,
      maxHeight: field === "watermarkBase64" ? 1600 : 1200,
      quality: field === "watermarkBase64" ? 0.75 : 0.82,
      outputType: "image/jpeg",
    })
      .then((compressedBase64) => {
        if (!compressedBase64) throw new Error("empty");
        setForm((p) => ({ ...p, [field]: compressedBase64 }));
        setPreview(compressedBase64);
      })
      .catch(async () => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const base64 = ev.target?.result as string;
          setForm((p) => ({ ...p, [field]: base64 }));
          setPreview(base64);
        };
        reader.readAsDataURL(file);
      });
    };
    const MAX_IMAGE_DIMENSION = 1200;
    const OUTPUT_QUALITY = 0.82;
    
    async function compressImageToDataUrl(
      file: File,
      options?: {
        maxWidth?: number;
        maxHeight?: number;
        quality?: number;
        outputType?: "image/jpeg" | "image/png" | "image/webp";
      }
    ): Promise<string> {
      const {
        maxWidth = MAX_IMAGE_DIMENSION,
        maxHeight = MAX_IMAGE_DIMENSION,
        quality = OUTPUT_QUALITY,
        outputType = "image/png",
      } = options || {};
    
      const fileDataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Failed to read image"));
      reader.readAsDataURL(file);
    });
    
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new window.Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("Failed to load image"));
        image.src = fileDataUrl;
      });
    
      let targetWidth = img.width;
      let targetHeight = img.height;
    
      const ratio = Math.min(maxWidth / targetWidth, maxHeight / targetHeight, 1);
    
      targetWidth = Math.round(targetWidth * ratio);
      targetHeight = Math.round(targetHeight * ratio);
    
      const canvas = document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = targetHeight;
    
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas not supported");
    
      ctx.clearRect(0, 0, targetWidth, targetHeight);
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
    
      return canvas.toDataURL(outputType, quality);
    }
    
    const handleImageRemove = (
      field: "logoBase64" | "stampBase64" | "watermarkBase64" | "accountantSignatureBase64" | "receiverSignatureBase64",
      setPreview?: (value: string) => void
    ) => {
      setForm((prev) => ({ ...prev, [field]: null }));
      setPreview?.("");
    };
  
    const handleSave = async () => {
      setSaving(true);
      try {
        const token = sessionStorage.getItem("auth_token");
        const { id, updatedAt, createdAt, ...rawPayload } = form as any;

        const payload = {
          ...rawPayload,
          nameAr: rawPayload.nameAr ?? "",
          nameEn: rawPayload.nameEn ?? "",
          subtitleAr: rawPayload.subtitleAr ?? "",
          subtitleEn: rawPayload.subtitleEn ?? "",
          taglineAr: rawPayload.taglineAr ?? "",
          taglineEn: rawPayload.taglineEn ?? "",
          email: rawPayload.email ?? "",
          phone: rawPayload.phone ?? "",
          address: rawPayload.address ?? "",
          poBox: rawPayload.poBox ?? "",
          website: rawPayload.website ?? "",
          crNumber: rawPayload.crNumber ?? "",
          taxNumber: rawPayload.taxNumber ?? "",
          footerText: rawPayload.footerText ?? "",
          logoSize: Number(rawPayload.logoSize ?? 80),
          invoiceCashTitleAr: rawPayload.invoiceCashTitleAr ?? "",
          invoiceCashTitleEn: rawPayload.invoiceCashTitleEn ?? "",
          invoiceCreditTitleAr: rawPayload.invoiceCreditTitleAr ?? "",
          invoiceCreditTitleEn: rawPayload.invoiceCreditTitleEn ?? "",
          statementTitleAr: rawPayload.statementTitleAr ?? "كشف حساب",
          statementTitleEn: rawPayload.statementTitleEn ?? "Statement",
          statementTitleFontSize: Number(rawPayload.statementTitleFontSize ?? 18),
          customerLedgerTitleAr: rawPayload.customerLedgerTitleAr ?? "ملخص العميل المالي",
          customerLedgerTitleEn: rawPayload.customerLedgerTitleEn ?? "Customer Financial Summary",
          customerLedgerTitleFontSize: Number(rawPayload.customerLedgerTitleFontSize ?? 18),
          showWatermark: rawPayload.showWatermark ?? true,
          showStampOnInvoices: rawPayload.showStampOnInvoices ?? true,
          showStampOnReceipts: rawPayload.showStampOnReceipts ?? true,
          showStampOnStatements: rawPayload.showStampOnStatements ?? true,
          accountantSignatureBase64: rawPayload.accountantSignatureBase64 ?? null,
          receiverSignatureBase64: rawPayload.receiverSignatureBase64 ?? null,
          showAccountantSignature: rawPayload.showAccountantSignature ?? true,
          showReceiverSignature: rawPayload.showReceiverSignature ?? true,
          invoiceTitleFontSize: Number(rawPayload.invoiceTitleFontSize ?? 25),
        };

        if (!canEditBrandIdentity) {
          Object.assign(payload, {
            nameAr: settings.nameAr ?? "",
            nameEn: settings.nameEn ?? "",
            logoBase64: settings.logoBase64 ?? null,
            logoSize: Number(settings.logoSize ?? 80),
            stampBase64: settings.stampBase64 ?? null,
            watermarkBase64: settings.watermarkBase64 ?? null,
            showWatermark: settings.showWatermark ?? true,
            showStampOnInvoices: settings.showStampOnInvoices ?? true,
            showStampOnReceipts: settings.showStampOnReceipts ?? true,
            showStampOnStatements: settings.showStampOnStatements ?? true,
          });
        }

        console.log("payload accountant:", payload.accountantSignatureBase64?.slice?.(0, 50));
        const res = await fetch(`${API_BASE}/company-settings`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(payload),
        });
    
        if (!res.ok) throw new Error("Failed");
    
        const saved = await res.json();
        const mergedSaved = { ...DEFAULT_SETTINGS, ...saved };
    
        setForm(mergedSaved);
        setSettings(mergedSaved);
        sessionStorage.setItem("company_settings", JSON.stringify(mergedSaved));
    
        await refresh();
    
        toast({
          title: isAR
            ? "✅ تم الحفظ بنجاح — التغييرات مفعلة الآن"
            : "✅ Saved — changes are now active",
        });
      } catch {
        toast({
          title: isAR ? "حدث خطأ أثناء الحفظ" : "Save failed",
          variant: "destructive",
        });
      } finally {
        setSaving(false);
      }
    };

  const Toggle = ({ field, disabled = false }: { field: keyof CompanySettings; disabled?: boolean }) => (
    <button
      type="button"
      disabled={disabled}
      onClick={() => setForm(p => ({ ...p, [field]: !p[field] }))}
      className={cn(tog(!!form[field]), disabled && "cursor-not-allowed opacity-50")}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-transform ${form[field] ? "translate-x-5" : ""}`}
      />
    </button>
  );

  const currentLogoSrc = logoPreview || logoSrc;
  const currentStampSrc = stampPreview || stampSrc;
  const currentWatermarkSrc = watermarkPreview || watermarkSrc;

  const TABS = [
  { id: "preview", icon: Eye, labelAr: "المعاينة", labelEn: "Preview", color: "text-indigo-500" },

  { id: "company", icon: Building2, labelAr: "بيانات الشركة", labelEn: "Company", color: "text-blue-500" },
  { id: "branding", icon: Image, labelAr: "الشعارات", labelEn: "Branding", color: "text-purple-500" },
  { id: "print", icon: Printer, labelAr: "أدوات الطباعة", labelEn: "Print Tools", color: "text-rose-500" },
  { id: "backup", icon: Shield, labelAr: "النسخ الاحتياطي", labelEn: "Backup", color: "text-emerald-500" },
  { id: "update", icon: RefreshCw, labelAr: "تحديث البرنامج", labelEn: "Software Update", color: "text-cyan-500" },

  { id: "display", icon: Palette, labelAr: "المظهر", labelEn: "Display", color: "text-fuchsia-500" }, // آخر واحد
];

  const resolvedName = (isAR ? user?.displayNameAr : user?.displayNameEn) || user?.displayName || "";
  const roleLabel = isAR
    ? (user?.role === "admin" ? "مدير" : user?.role === "supervisor" ? "مشرف" : "مستخدم")
    : (user?.role === "admin" ? "Admin" : user?.role === "supervisor" ? "Supervisor" : "User");
  const canSeeDeveloperLink = user?.role === "admin" || user?.role === "manager";
  const isAdminSettings = user?.role === "admin";
  const canViewSettingsTab = (tabId: TabId) => {
    if (isAdminSettings) return true;
    if (tabId === "preview") return true;
    if (tabId === "display") return true;
    if (tabId === "company") return allowManagerEditLegalInfo;
    if (tabId === "branding") return allowManagerEditBranding;
    if (tabId === "print") return allowManagerEditPrintSettings;
    if (tabId === "backup") return allowManagerEditInvoicesBackupImport;
    if (tabId === "update") return allowManagerViewUpdate;
    return false;
  };
  const visibleTabs = TABS.filter((tab) => canViewSettingsTab(tab.id));
  const visibleTabIds = visibleTabs.map((tab) => tab.id).join("|");

  useEffect(() => {
    if (visibleTabs.length > 0 && !visibleTabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(visibleTabs[0].id);
    }
    if (activeTab === "backup" && backupView === "database-sync") {
      setBackupView("backup-import");
    }
  }, [activeTab, backupView, visibleTabIds]);

  if (visibleTabs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-muted-foreground">
        <Shield className="w-16 h-16 opacity-20" />
        <p className="text-lg font-semibold">{isAR ? "لا توجد صلاحيات إعدادات مفعلة لهذا المستخدم" : "No settings permissions are enabled for this user"}</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      dir={isRTL ? "rtl" : "ltr"}
      className="flex w-full gap-5 pb-10 items-start"
    >
      {/* ── Sticky Sidebar ─────────────────────────────────────── */}
      <div className="sticky top-4 self-start w-48 shrink-0 space-y-3">

        {/* User card */}
        <div className="bg-card rounded-2xl border border-border/50 shadow-sm p-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-black text-sm shadow-md shrink-0">
              {resolvedName?.[0]?.toUpperCase() || <User className="w-3.5 h-3.5" />}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold truncate leading-tight">
                {isAR ? (resolvedName || user?.displayName) : (user?.displayNameEn || resolvedName || user?.displayName)}
              </p>
              <div className="flex flex-col items-start">
                <span className="text-sm font-medium text-muted-foreground">{roleLabel}</span>
                {canSeeDeveloperLink && (
                  <span
                    onDoubleClick={() => {
                      window.location.hash = "/settings/developer";
                    }}
                    className="mt-1 text-[10px] text-muted-foreground/40 hover:text-muted-foreground/70 select-none"
                  >
                    {import.meta.env.VITE_APP_VERSION || "v2.0.0"}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tab list */}
        <nav className="bg-card rounded-2xl border border-border/50 shadow-sm p-2 space-y-0.5">
          {visibleTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-start",
                activeTab === tab.id
                  ? "bg-primary/10 text-primary font-semibold shadow-sm ring-1 ring-primary/20"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <tab.icon className={cn("w-3.5 h-3.5 shrink-0", activeTab === tab.id ? "text-primary" : tab.color)} />
              <div className="flex items-center justify-between w-full">
              <span>{isAR ? tab.labelAr : tab.labelEn}</span>

              {activeTab === tab.id && (
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              )}
            </div>
            </button>
          ))}
        </nav>

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl shadow-lg shadow-primary/20 hover:-translate-y-0.5 transition-all disabled:opacity-60 text-sm"
        >
          {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          {saving ? (isAR ? "جارٍ الحفظ..." : "Saving...") : (isAR ? "حفظ التغييرات" : "Save Changes")}
        </button>
      </div>

      {/* ── Content Area ───────────────────────────────────────── */}
      <div className="flex-1 min-w-0 w-full space-y-5">

        {/* Section title */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">
              {activeTab === "preview" && (isAR ? "المعاينة" : "Preview")}
              {activeTab === "company" && (isAR ? "بيانات الشركة" : "Company")}
              {activeTab === "branding" && (isAR ? "الشعارات" : "Branding")}
              {activeTab === "print" && (isAR ? "أدوات الطباعة" : "Print Tools")}
              {activeTab === "backup" && (isAR ? "النسخ الاحتياطي" : "Backup")}
              {activeTab === "update" && (isAR ? "تحديث البرنامج" : "Software Update")}
              {activeTab === "display" && (isAR ? "المظهر" : "Display")}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {activeTab === "preview" && (isAR ? "معاينة مباشرة لشكل المستندات قبل الطباعة" : "Live preview of documents before printing")}
              {activeTab === "company" && (isAR ? "إدارة بيانات الشركة الأساسية ومعلومات التواصل" : "Manage company identity and contact details")}
              {activeTab === "branding" && (isAR ? "إدارة الشعار والختم والعلامة المائية والتوقيعات" : "Manage logo, stamp, watermark, and signatures")}
              {activeTab === "print" && (isAR ? "ضبط عناوين الفواتير وأدوات الطباعة" : "Configure invoice titles and print tools")}
              {activeTab === "backup" && (isAR ? "تصدير واستيراد النسخ الاحتياطية بأمان" : "Securely export and import backups")}
              {activeTab === "update" && (isAR ? "البحث عن تحديثات البرنامج وتثبيتها من داخل التطبيق" : "Check and install application updates from inside the app")}
              {activeTab === "display" && (isAR ? "ضبط ألوان ومظهر واجهة البرنامج" : "Customize application colors and appearance")}
            </p>
          </div>
        </div>
        

          {/* ── Preview Tab Content ── */}

          {activeTab === "preview" && (
              <div className="w-full max-w-none bg-gradient-to-br from-primary/5 to-transparent p-2 rounded-2xl border border-primary/10">
                <Section
                  icon={Eye}
                  title={isAR ? "المعاينة" : "Preview"}
                  color="bg-primary/5"
                  contentClassName="p-3"
                >
                <div className="mb-4 w-full rounded-xl border border-border/60 bg-background/80 p-3">
                  <div className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground">
                    <SlidersHorizontal className="h-4 w-4 text-primary" />
                    <span>{isAR ? "تكبير وتصغير المستندات" : "Document Zoom"}</span>
                  </div>
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                    <PreviewScaleControl
                      label={isAR ? "تكبير الفاتورة" : "Invoice zoom"}
                      value={invoicePreviewScale}
                      min={0.55}
                      max={1.1}
                      onChange={setInvoicePreviewScale}
                    />
                    <PreviewScaleControl
                      label={isAR ? "تكبير سند القبض" : "Receipt zoom"}
                      value={receiptPreviewScale}
                      min={0.55}
                      max={1.1}
                      onChange={setReceiptPreviewScale}
                    />
                    <PreviewScaleControl
                      label={isAR ? "تكبير كشف الحساب" : "Statement zoom"}
                      value={statementPreviewScale}
                      min={0.55}
                      max={1.1}
                      onChange={setStatementPreviewScale}
                    />
                  </div>
                </div>
                <SettingsPrintPreviews
                  settings={{
                    ...settings,
                    ...form,
                    logoBase64: logoPreview ?? form.logoBase64,
                    stampBase64: stampPreview ?? form.stampBase64,
                    watermarkBase64: watermarkPreview ?? form.watermarkBase64,
                    accountantSignatureBase64: accountantSignaturePreview ?? form.accountantSignatureBase64,
                    receiverSignatureBase64: receiverSignaturePreview ?? form.receiverSignatureBase64,
                  }}
                  logoSrc={currentLogoSrc}
                  stampSrc={currentStampSrc}
                  watermarkSrc={currentWatermarkSrc}
                  isAR={isAR}
                  invoicePreviewScale={invoicePreviewScale}
                  receiptPreviewScale={receiptPreviewScale}
                  statementPreviewScale={statementPreviewScale}
                />
                <div className="hidden">
                  <h3 className="text-sm font-bold mb-3 text-primary">
                    {isAR ? "🔍 معاينة مباشرة للمستندات" : "🔍 Live Document Preview"}
                  </h3>

                  <div className="h-0.5 w-12 bg-primary rounded-full mb-4" />

                  <div className="space-y-4">

                    {/* Invoice Preview */}

                    <div className="border rounded-lg p-3 bg-white shadow-sm">
                      <InvoicePrintHeader
                        company={form}
                        logoSrc={currentLogoSrc}
                        isAR={isAR}
                        invoiceNumber="INV-001"
                        statusText={isAR ? "معاينة" : "Preview"}
                      />

                      <div className="mt-3 border-t pt-3 text-xs text-slate-700 space-y-3">
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="rounded border p-2">
                            <div className="font-bold">{isAR ? "البيان" : "Description"}</div>
                            <div>{isAR ? "خدمة تخليص جمركي" : "Customs Clearance Service"}</div>
                          </div>

                          <div className="rounded border p-2">
                            <div className="font-bold">{isAR ? "الكمية" : "Qty"}</div>
                            <div>1</div>
                          </div>

                          <div className="rounded border p-2">
                            <div className="font-bold">{isAR ? "الإجمالي" : "Total"}</div>
                            <div>1,250</div>
                          </div>
                        </div>

                        {form.footerText && (
                          <div className="text-center text-[11px] text-slate-500 border-t pt-2">
                            {form.footerText}
                          </div>
                        )}

                        <div className="grid grid-cols-3 items-end gap-3 pt-2">
                          <div className="text-center">
                            {form.showAccountantSignature && form.accountantSignatureBase64 && (
                              <img
                                src={form.accountantSignatureBase64}
                                alt="accountant signature"
                                className="h-10 mx-auto object-contain"
                              />
                            )}
                            <div className="border-t mt-2 pt-1">
                              {isAR ? "توقيع المحاسب" : "Accountant Signature"}
                            </div>
                          </div>

                          <div className="text-center">
                            {form.showStampOnInvoices && form.stampBase64 && (
                              <img
                                src={form.stampBase64}
                                alt="stamp"
                                className="h-12 mx-auto object-contain opacity-90"
                              />
                            )}
                            <div className="text-[11px] text-slate-500">
                              {isAR ? "الختم" : "Stamp"}
                            </div>
                          </div>

                          <div className="text-center">
                            {form.showReceiverSignature && form.receiverSignatureBase64 && (
                              <img
                                src={form.receiverSignatureBase64}
                                alt="receiver signature"
                                className="h-10 mx-auto object-contain"
                              />
                            )}
                            <div className="border-t mt-2 pt-1">
                              {isAR ? "توقيع المستلم" : "Receiver Signature"}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Small previews row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Receipt Preview */}
                      <div className="border rounded-lg p-3 bg-white shadow-sm text-xs">
                        <div className="font-bold mb-2">
                          {isAR ? "سند قبض" : "Receipt"}
                        </div>

                        <div className="flex justify-between">
                          <span>{isAR ? "العميل" : "Client"}</span>
                          <span>{isAR ? "عميل تجريبي" : "Sample Client"}</span>
                        </div>

                        <div className="flex justify-between">
                          <span>{isAR ? "المبلغ" : "Amount"}</span>
                          <span>1,250</span>
                        </div>
                      </div>

                      {/* Statement Preview */}
                      <div className="border rounded-lg p-3 bg-white shadow-sm text-xs">
                        <div className="font-bold mb-2">
                          {isAR ? "كشف حساب" : "Statement"}
                        </div>

                        <div className="flex justify-between">
                          <span>{isAR ? "الرصيد" : "Balance"}</span>
                          <span>3,450</span>
                        </div>

                        <div className="flex justify-between">
                          <span>{isAR ? "آخر حركة" : "Last Activity"}</span>
                          <span>INV-001</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Section>
            </div>
           )}

          {/* ── Backup & Import Tab | النسخ الاحتياطي والاستيراد ── */}
          {activeTab === "backup" && (
            <Section
              icon={Shield}
              title={isAR ? "النسخ الاحتياطي والاستيراد" : "Backup & Import"}
              color="bg-emerald-500/5"
            >
              <div className="space-y-4">
                {/* Program Data - خارج الإطار */}
                <div className="grid grid-cols-1 gap-2 rounded-xl border border-border/60 bg-muted/20 p-1" dir={isAR ? "rtl" : "ltr"}>
                  {[
                    { id: "backup-import" as BackupView, icon: Shield, labelAr: "النسخ والاستيراد", labelEn: "Backup & Import" },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setBackupView(item.id)}
                      className={cn(
                        "flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition",
                        backupView === item.id
                          ? "bg-background text-primary shadow-sm ring-1 ring-primary/20"
                          : "text-muted-foreground hover:bg-background/70 hover:text-foreground"
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{isAR ? item.labelAr : item.labelEn}</span>
                    </button>
                  ))}
                </div>

                {backupView === "backup-import" && (
                  <>
                <div className={`${isAR ? "text-right" : "text-left"}`}>
                  <h3 className="text-sm font-bold text-foreground">
                    {isAR ? "بيانات البرنامج" : "Program Data"}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {isAR
                      ? "تصدير واستيراد بيانات البرنامج من مكان واحد."
                      : "Export and import program data from one place."}
                  </p>
                </div>


                {/* الإطار الكبير Big frame */}
                <div
                  className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm"
                  dir={isAR ? "rtl" : "ltr"}
                >
                  {/* All Data Row "كل البيانات" */}
                  <div className="border rounded-lg p-3 mb-3">
                    <div className="flex items-center justify-between gap-3 w-full">
                      <span className="text-sm font-medium whitespace-nowrap">
                        {isAR ? "كل البيانات" : "All Data"}
                      </span>

                      <div className="flex items-center gap-2">
                        {/* Export password */}
                        <div className="relative">
                          <input
                            type={showBackupPassword ? "text" : "password"}
                            value={backupPassword}
                            onChange={(e) => setBackupPassword(e.target.value)}
                            placeholder={isAR ? "كلمة مرور التصدير" : "Export password"}
                            className={`h-8 w-32 rounded-md border px-2 text-xs ${
                              isAR ? "pl-9" : "pr-9"
                            }`}
                          />

                          <button
                            type="button"
                            onClick={() => setShowBackupPassword(!showBackupPassword)}
                            className={`absolute top-1/2 -translate-y-1/2 ${
                              isAR ? "left-1" : "right-1"
                            } p-1 text-gray-600 hover:text-black`}
                          >
                            {showBackupPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        </div>

                        {/* Export button */}

                      <button
                        type="button"
                        onClick={async () => {
                          const password = backupPassword.trim();
                          if (!password) {
                            alert(isAR ? "أدخل كلمة مرور للتصدير" : "Enter export password");
                            return;
                          }

                          const token = sessionStorage.getItem("auth_token");

                          const [invoices, receipts, clients, items] = await Promise.all([
                            fetch("http://127.0.0.1:3000/api/invoices", {
                              headers: { Authorization: `Bearer ${token}` },
                            }).then((r) => r.json()),
                            fetch("http://127.0.0.1:3000/api/receipts", {
                              headers: { Authorization: `Bearer ${token}` },
                            }).then((r) => r.json()),
                            fetch("http://127.0.0.1:3000/api/clients", {
                              headers: { Authorization: `Bearer ${token}` },
                            }).then((r) => r.json()),
                            fetch("http://127.0.0.1:3000/api/invoice-item-templates", {
                              headers: { Authorization: `Bearer ${token}` },
                            }).then((r) => r.json()),
                          ]);

                          const rawData = { invoices, receipts, clients, items };

                          const fullData = await encryptBackupData(rawData, password);

                          const blob = new Blob([JSON.stringify(fullData, null, 2)], {
                            type: "application/json",
                          });

                          const a = document.createElement("a");
                          a.href = URL.createObjectURL(blob);
                          a.download = "full-backup.json";
                          document.body.appendChild(a);
                          a.click();
                          a.remove();
                        }}
                        className="h-8 px-3 text-xs bg-blue-50 rounded-md hover:bg-blue-100 transition"
                      >
                        {isAR ? "تصدير" : "Export"}
                      </button>

                      <div className="relative">
                        <input
                          type={showImportPassword ? "text" : "password"}
                          value={importPassword}
                          onChange={(e) => setImportPassword(e.target.value)}
                          placeholder={isAR ? "كلمة مرور الاستيراد" : "Import password"}
                          className={`h-8 w-32 rounded-md border px-2 text-xs ${
                            isAR ? "pl-9" : "pr-9"
                          }`}
                        />

                        <button
                          type="button"
                          onClick={() => setShowImportPassword(!showImportPassword)}
                          className={`absolute top-1/2 -translate-y-1/2 ${
                            isAR ? "left-1" : "right-1"
                          } p-1 text-gray-600 hover:text-black`}
                        >
                          {showImportPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => document.getElementById("full-import")?.click()}
                        className="h-8 px-3 text-xs bg-green-50 rounded-md hover:bg-green-100 transition"
                      >
                        {isAR ? "استيراد" : "Import"}
                      </button>
                    </div>
                  </div>
                 </div>

                 <div
                  className="flex items-center justify-between border rounded-lg px-3 py-2 mt-2 w-full"
                  dir={isAR ? "rtl" : "ltr"}
                >
                  <span className="text-sm whitespace-nowrap">
                    {isAR ? "كلمة مرور الطوارئ (الماستر)" : "Master Emergency Password"}
                  </span>

                  <div className="relative">
                    <input
                      type={showMasterPassword ? "text" : "password"}
                      value={form.masterPassword || ""}
                      onChange={(e) => setForm((f) => ({ ...f, masterPassword: e.target.value }))}
                      placeholder={isAR ? "اتركها فارغة لعدم التغيير" : "Leave empty to keep unchanged"}
                      className={`h-8 w-40 rounded-md border text-xs ${
                        isAR ? "pl-8 pr-2" : "pr-8 pl-2"
                      }`}
                    />

                    <button
                      type="button"
                      onClick={() => setShowMasterPassword((v) => !v)}
                      className={`absolute top-1/2 -translate-y-1/2 ${
                        isAR ? "left-2" : "right-2"
                      } text-gray-600`}
                    >
                      {showMasterPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                  <input
                    id="full-import"
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;

                      const backupFile = JSON.parse(await file.text());
                      const enteredPassword = importPassword.trim();

                      let fullData;

                      if (backupFile.encrypted) {
                        try {
                          fullData = await decryptBackupData(backupFile, enteredPassword);
                        } catch {
                          alert(isAR ? "كلمة المرور غير صحيحة أو الملف تالف" : "Wrong password or corrupted file");
                          return;
                        }
                      } else {
                        // دعم النسخ القديمة
                        if (backupFile.password !== enteredPassword) {
                          alert(isAR ? "كلمة المرور غير صحيحة" : "Wrong password");
                          return;
                        }
                        fullData = backupFile;
                      }

                      if (fullData.clients) {
                        await importClients(new File([new Blob([JSON.stringify(fullData.clients)])], "clients.json"));
                      }
                      if (fullData.items) {
                        await importItems(new File([new Blob([JSON.stringify(fullData.items)])], "items.json"));
                      }
                      if (fullData.invoices) {
                        await importInvoices(new File([new Blob([JSON.stringify(fullData.invoices)])], "invoices.json"), { bypassDeveloperPermission: true });
                      }
                      if (fullData.receipts) {
                        await importReceipts(new File([new Blob([JSON.stringify(fullData.receipts)])], "receipts.json"));
                      }

                      alert(isAR ? "تم استيراد كامل البيانات" : "Full data imported successfully");
                    }}
                  />

                  <div className="grid grid-cols-2 gap-3 mt-4">
                    {/* الفواتير */}
                    <div className="flex justify-between items-center border rounded-lg p-2">
                      <span className="text-sm">{isAR ? "الفواتير" : "Invoices"}</span>
                      <div className="flex gap-2">
                        <button type="button" onClick={exportInvoices} disabled={!canUseInvoicesBackupImport} className={cn("h-8 px-3 text-xs bg-blue-50 rounded-md hover:bg-blue-100 transition", !canUseInvoicesBackupImport && "cursor-not-allowed opacity-50 hover:bg-blue-50")}>
                          {isAR ? "تصدير" : "Export"}
                        </button>
                        <button type="button" disabled={!canUseInvoicesBackupImport} onClick={() => { if (!canUseInvoicesBackupImport) return; }} className={cn("h-8 px-3 text-xs bg-green-50 rounded-md hover:bg-green-100 transition", !canUseInvoicesBackupImport && "cursor-not-allowed opacity-50 hover:bg-green-50")}>
                          {isAR ? "استيراد" : "Import"}
                        </button>
                      </div>
                    </div>

                    {/* العملاء */}
                    <div className="flex justify-between items-center border rounded-lg p-2">
                      <span className="text-sm">{isAR ? "العملاء" : "Clients"}</span>
                      <div className="flex gap-2">
                        <button type="button" onClick={exportClients} className="h-8 px-3 text-xs bg-blue-50 rounded-md hover:bg-blue-100 transition">
                          {isAR ? "تصدير" : "Export"}
                        </button>
                        <button type="button" className="h-8 px-3 text-xs bg-green-50 rounded-md hover:bg-green-100 transition">
                          {isAR ? "استيراد" : "Import"}
                        </button>
                      </div>
                    </div>

                    {/* سندات القبض */}
                    <div className="flex justify-between items-center border rounded-lg p-2">
                      <span className="text-sm">{isAR ? "سندات القبض" : "Receipts"}</span>
                      <div className="flex gap-2">
                        <button type="button" onClick={exportReceipts} className="h-8 px-3 text-xs bg-blue-50 rounded-md hover:bg-blue-100 transition">
                          {isAR ? "تصدير" : "Export"}
                        </button>
                        <button type="button" className="h-8 px-3 text-xs bg-green-50 rounded-md hover:bg-green-100 transition">
                          {isAR ? "استيراد" : "Import"}
                        </button>
                      </div>
                    </div>

                    {/* البنود */}
                    <div className="flex justify-between items-center border rounded-lg p-2">
                      <span className="text-sm">{isAR ? "البنود" : "Items"}</span>
                      <div className="flex gap-2">
                        <button type="button" onClick={exportItems} className="h-8 px-3 text-xs bg-blue-50 rounded-md hover:bg-blue-100 transition">
                          {isAR ? "تصدير" : "Export"}
                        </button>
                        <button type="button" className="h-8 px-3 text-xs bg-green-50 rounded-md hover:bg-green-100 transition">
                          {isAR ? "استيراد" : "Import"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                  </>
                )}
              </div>
            </Section>
          )}

          {activeTab === "update" && (
            <Section
              icon={RefreshCw}
              title={isAR ? "تحديث البرنامج" : "Software Update"}
              color="bg-cyan-500/5"
            >
              <div className="space-y-4" dir={isAR ? "rtl" : "ltr"}>
                <div className={`${isAR ? "text-right" : "text-left"}`}>
                  <h3 className="text-sm font-bold text-foreground">
                    {isAR ? "التحديث التلقائي" : "Automatic Updates"}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {isAR
                      ? "يتم فحص تحديثات GitHub Releases وتنزيلها ثم تثبيتها بدون التأثير على قاعدة بيانات AppData."
                      : "Checks GitHub Releases, downloads updates, and installs them without touching the AppData database."}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div className="rounded-xl border border-border bg-background p-3">
                      <div className="text-xs font-semibold uppercase text-muted-foreground">
                        {isAR ? "الإصدار الحالي" : "Current Version"}
                      </div>
                      <div className="mt-1 font-mono text-sm font-bold text-foreground">
                        {import.meta.env.VITE_APP_VERSION || "2.0.0"}
                      </div>
                    </div>

                    <div className="rounded-xl border border-border bg-background p-3 md:col-span-2">
                      <div className="text-xs font-semibold uppercase text-muted-foreground">
                        {isAR ? "حالة التحديث" : "Update Status"}
                      </div>
                      <div className="mt-1 text-sm font-semibold text-foreground">{updateStatus}</div>
                      {updateVersion && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          {isAR ? "الإصدار المتاح:" : "Available version:"} <span className="font-mono">{updateVersion}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${updateProgress}%` }}
                    />
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={checkingUpdate}
                      onClick={async () => {
                        const api = (window as any).electronAPI;
                        if (!api?.checkForUpdates) {
                          setUpdateStatus(isAR ? "التحديث متاح فقط داخل نسخة Electron." : "Updates are only available in the Electron app.");
                          return;
                        }

                        setCheckingUpdate(true);
                        try {
                          await api.checkForUpdates();
                        } catch (error: any) {
                          setCheckingUpdate(false);
                          setUpdateStatus(error?.message || (isAR ? "فشل البحث عن تحديث." : "Failed to check for updates."));
                        }
                      }}
                      className="h-9 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                    >
                      {checkingUpdate ? (isAR ? "جاري البحث..." : "Checking...") : (isAR ? "البحث عن تحديث" : "Check for Updates")}
                    </button>

                    <button
                      type="button"
                      onClick={async () => {
                        const api = (window as any).electronAPI;
                        if (!api?.downloadUpdate) {
                          setUpdateStatus(isAR ? "تحميل التحديث متاح فقط داخل نسخة Electron." : "Update download is only available in the Electron app.");
                          return;
                        }

                        try {
                          await api.downloadUpdate();
                        } catch (error: any) {
                          setUpdateStatus(error?.message || (isAR ? "فشل تحميل التحديث." : "Failed to download update."));
                        }
                      }}
                      className="h-9 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                    >
                      {isAR ? "تحميل التحديث" : "Download Update"}
                    </button>

                    <button
                      type="button"
                      disabled={!updateReady}
                      onClick={async () => {
                        const api = (window as any).electronAPI;
                        if (!api?.installUpdate) {
                          setUpdateStatus(isAR ? "تثبيت التحديث متاح فقط داخل نسخة Electron." : "Update install is only available in the Electron app.");
                          return;
                        }

                        await api.installUpdate();
                      }}
                      className="h-9 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                    >
                      {isAR ? "تثبيت التحديث" : "Install Update"}
                    </button>
                  </div>
                </div>
              </div>
            </Section>
          )}

          

          {/* ── Display Tab ── */}

        {activeTab === "display" && canEditAppearance && (() => {
          const storedTheme = sessionStorage.getItem("theme");
          const currentTheme = storedTheme === "dark" ? "dark" : storedTheme === "light" ? "light" : "system";
          const toggleTheme = (mode: "light" | "dark" | "system") => {
            if (mode === "dark") { document.documentElement.classList.add("dark"); sessionStorage.setItem("theme", "dark"); }
            else if (mode === "light") { document.documentElement.classList.remove("dark"); sessionStorage.setItem("theme", "light"); }
            else { sessionStorage.removeItem("theme"); document.documentElement.classList.toggle("dark", window.matchMedia("(prefers-color-scheme: dark)").matches); }
          };

          const ToggleSwitch = ({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) => (
            <button type="button" onClick={() => onChange(!on)} className={tog(on)}>
              <span className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-transform ${on ? "translate-x-5" : ""}`} />
            </button>
          );

          const SectionCard = ({ icon: Icon, title, color, children }: { icon: React.ElementType; title: string; color: string; children: React.ReactNode }) => (
            <div className="bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden">
              <div className={`flex items-center gap-2 px-5 py-3.5 border-b border-border/40 ${color}`}>
                <Icon className="w-3.5 h-3.5" /><h2 className="text-sm font-bold">{title}</h2>
              </div>
              <div className="p-5">{children}</div>
            </div>
          );

          return (
            <>
            <div className="space-y-4 max-h-[520px] overflow-y-auto pr-2">

              {/* ─ Theme ─ */}
              <SectionCard icon={Sun} title={isAR ? "ثيم الواجهة" : "Interface Theme"} color="bg-yellow-500/5">
                <div className="grid grid-cols-3 gap-2">
                  {([["light", Sun, isAR ? "فاتح" : "Light"], ["dark", Moon, isAR ? "داكن" : "Dark"], ["system", Monitor, isAR ? "تلقائي" : "System"]] as const).map(([mode, Icon, label]) => (
                    <button key={mode} onClick={() => { toggleTheme(mode); }}
                      className={cn("flex flex-col items-center gap-2 py-4 px-2 rounded-xl text-xs font-semibold border-2 transition-all",
                        currentTheme === mode ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                      )}>
                      <Icon className="w-3.5 h-3.5" />{label}
                    </button>
                  ))}
                </div>
              </SectionCard>

              {/* ─ Primary Color ─ */}
              <SectionCard icon={Palette} title={isAR ? "اللون الأساسي" : "Primary Color"} color="bg-fuchsia-500/5">
                <div className="grid grid-cols-7 gap-2">
                  {(Object.entries(COLOR_PRESETS) as [PrimaryColor, typeof COLOR_PRESETS[PrimaryColor]][]).map(([key, preset]) => (
                    <button key={key} onClick={() => updateDisplay({ primaryColor: key })}
                      title={isAR ? preset.labelAr : preset.labelEn}
                      className={cn("flex flex-col items-center gap-2 py-3 rounded-xl border-2 transition-all text-xs font-semibold",
                        display.primaryColor === key ? "border-current shadow-lg scale-105" : "border-transparent hover:border-border hover:scale-105"
                      )}
                      style={{ color: preset.hex }}
                    >
                      <span className="w-8 h-8 rounded-full shadow-md border-2 border-white/20 block"
                        style={{ background: preset.hex }} />
                      <span className="text-foreground">{isAR ? preset.labelAr : preset.labelEn}</span>
                    </button>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-border/40 flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">{isAR ? "معاينة:" : "Preview:"}</span>
                  <div className="flex items-center gap-2">
                    <span className="h-6 px-3 rounded-full text-xs font-bold flex items-center text-white"
                      style={{ background: COLOR_PRESETS[display.primaryColor].hex }}>
                      {isAR ? "زر أساسي" : "Primary Button"}
                    </span>
                    <span className="h-6 px-3 rounded-full text-xs font-bold flex items-center border-2"
                      style={{ borderColor: COLOR_PRESETS[display.primaryColor].hex, color: COLOR_PRESETS[display.primaryColor].hex }}>
                      {isAR ? "حد ملوّن" : "Outline"}
                    </span>
                  </div>
                </div>
              </SectionCard>

              {/* ─ Sidebar Color ─ */}
              <SectionCard icon={Layers} title={isAR ? "لون الشريط الجانبي" : "Sidebar Color"} color="bg-slate-500/5">
                <div className="grid grid-cols-4 gap-2">
                  {(Object.entries(SIDEBAR_COLOR_PRESETS) as [SidebarColor, typeof SIDEBAR_COLOR_PRESETS[SidebarColor]][]).map(([key, preset]) => (
                    <button key={key} onClick={() => updateDisplay({ sidebarColor: key })}
                      title={isAR ? preset.labelAr : preset.labelEn}
                      className={cn(
                        "flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all text-xs font-medium",
                        display.sidebarColor === key
                          ? "border-primary shadow-md scale-105"
                          : "border-transparent hover:border-border hover:scale-105"
                      )}
                    >
                      {/* Mini gradient preview */}
                      <div className="w-full h-10 rounded-lg shadow-inner border border-white/10 overflow-hidden">
                        <div className="w-full h-full" style={{ background: `linear-gradient(180deg, ${preset.from} 0%, ${preset.to} 100%)` }} />
                      </div>
                      <span className="text-foreground text-center leading-tight">{isAR ? preset.labelAr : preset.labelEn}</span>
                    </button>
                  ))}
                </div>
                {/* Live preview mini sidebar */}
                <div className="mt-4 pt-4 border-t border-border/40">
                  <p className="text-xs text-muted-foreground mb-2">{isAR ? "معاينة مصغّرة:" : "Preview:"}</p>
                  <div className="h-16 rounded-xl overflow-hidden shadow-md flex items-stretch"
                    style={{ background: `linear-gradient(180deg, ${SIDEBAR_COLOR_PRESETS[display.sidebarColor].from} 0%, ${SIDEBAR_COLOR_PRESETS[display.sidebarColor].to} 100%)` }}>
                    <div className="flex items-center gap-2 px-4">
                      <div className="w-6 h-6 rounded-lg bg-white/10" />
                      <div className="space-y-1">
                        <div className="w-16 h-2 rounded bg-white/30" />
                        <div className="w-10 h-1.5 rounded bg-white/15" />
                      </div>
                    </div>
                  </div>
                </div>
              </SectionCard>

              {/* ─ App Background ─ */}
              <SectionCard icon={Wallpaper} title={isAR ? "خلفية التطبيق" : "App Background"}color="bg-primary/5">
                {/* Type selector */}
                <div className="grid grid-cols-3 gap-2 mb-5">
                  {([
                    { v: "none"  as BgType, Icon: Ban,     labelAr: "بدون",    labelEn: "None"  },
                    { v: "color" as BgType, Icon: Blend,   labelAr: "لون",     labelEn: "Color" },
                    { v: "image" as BgType, Icon: Wallpaper, labelAr: "صورة",  labelEn: "Image" },
                  ]).map(({ v, Icon: Ic, labelAr, labelEn }) => (
                    <button key={v} onClick={() => updateDisplay({ bgType: v })}
                      className={cn(
                        "flex flex-col items-center gap-2 py-4 rounded-xl border-2 text-xs font-semibold transition-all",
                        display.bgType === v
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                      )}>
                      <Ic className="w-3.5 h-3.5" />
                      {isAR ? labelAr : labelEn}
                    </button>
                  ))}
                </div>

                {/* Color picker */}
                {display.bgType === "color" && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide shrink-0">
                        {isAR ? "اختر اللون" : "Pick color"}
                      </label>
                      <div className="flex items-center gap-3 flex-1">
                        <input
                          type="color"
                          value={display.bgColor}
                          onChange={e => updateDisplay({ bgColor: e.target.value })}
                          className="w-8 h-8 rounded-xl border border-border cursor-pointer p-0.5 bg-background"
                        />
                        <div className="flex flex-wrap gap-1.5">
                          {["#e8f0fe","#fce4ec","#e8f5e9","#fff3e0","#f3e5f5","#e0f7fa","#fafafa","#1e1e2e"].map(c => (
                            <button key={c} onClick={() => updateDisplay({ bgColor: c })}
                              title={c}
                              className={cn("w-6 h-6 rounded-lg border-2 transition-all hover:scale-110",
                                display.bgColor === c ? "border-primary scale-110 shadow-md" : "border-border/50"
                              )}
                              style={{ background: c }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                    {/* Mini preview */}
                    <div className="h-16 rounded-xl border border-border/40 overflow-hidden relative">
                      <div className="absolute inset-0" style={{ backgroundColor: display.bgColor, opacity: display.bgOpacity / 100 }} />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xs font-medium text-muted-foreground">{isAR ? "معاينة الخلفية" : "Background preview"}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Image upload */}
                {display.bgType === "image" && (() => {
                  const bgImgRef = { current: null as HTMLInputElement | null };
                  return (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => bgImgRef.current?.click()}
                          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold shadow hover:bg-primary/90 transition-colors"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          {isAR ? "رفع صورة" : "Upload Image"}
                        </button>
                        {display.bgImage && (
                          <button
                            onClick={() => updateDisplay({ bgImage: "" })}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-xs text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            {isAR ? "إزالة" : "Remove"}
                          </button>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          ref={el => { bgImgRef.current = el; }}
                          onChange={e => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            if (file.size > 600 * 1024) {
                              toast({ title: isAR ? "الصورة كبيرة جداً (600KB حد أقصى)" : "Image too large (max 600KB)", variant: "destructive" });
                              return;
                            }
                            const reader = new FileReader();
                            reader.onload = ev => updateDisplay({ bgImage: ev.target?.result as string });
                            reader.readAsDataURL(file);
                          }}
                        />
                      </div>
                      {/* Preview */}
                      <div className="h-28 rounded-xl border border-border/40 overflow-hidden relative bg-muted/20">
                        {display.bgImage ? (
                          <>
                            <img src={display.bgImage} alt="bg preview"
                              className="absolute inset-0 w-full h-full object-cover"
                              style={{ opacity: display.bgOpacity / 100 }}
                            />
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="text-xs font-medium bg-black/30 text-white px-2 py-1 rounded-lg">{isAR ? "معاينة" : "Preview"}</span>
                            </div>
                          </>
                        ) : (
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-muted-foreground">
                            <Wallpaper className="w-8 h-8 opacity-30" />
                            <p className="text-xs">{isAR ? "لم تُختر صورة بعد" : "No image selected"}</p>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{isAR ? "الحد الأقصى للحجم: 600KB · الصيغ المقبولة: JPG, PNG, WebP" : "Max size: 600KB · Accepted: JPG, PNG, WebP"}</p>
                    </div>
                  );
                })()}

                {/* Opacity slider — shown when type != none */}
                {display.bgType !== "none" && (
                  <div className="mt-5 pt-4 border-t border-border/40">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          {isAR ? "درجة الشفافية" : "Opacity"}
                        </span>
                      </div>
                      <span className="text-sm font-bold text-primary tabular-nums">{display.bgOpacity}%</span>
                    </div>
                    <div className="relative">
                      <input
                        type="range"
                        min={5} max={80} step={1}
                        value={display.bgOpacity}
                        onChange={e => updateDisplay({ bgOpacity: Number(e.target.value) })}
                        className="w-full h-2 rounded-full appearance-none cursor-pointer accent-primary bg-muted"
                      />
                      <div className="flex justify-between mt-1">
                        <span className="text-[10px] text-muted-foreground">5%</span>
                        <span className="text-[10px] text-muted-foreground">80%</span>
                      </div>
                    </div>
                  </div>
                )}
              </SectionCard>

              {/* ─ Border Radius ─ */}
              <SectionCard icon={Square} title={isAR ? "حجم الزوايا" : "Border Radius"} color="bg-blue-500/5">
                <div className="grid grid-cols-3 gap-3">
                  {([
                    { v: "sharp"   as BorderRadius, labelAr: "حادة",    labelEn: "Sharp",   radius: "rounded-sm",  Icon: Minus },
                    { v: "normal"  as BorderRadius, labelAr: "متوسطة",  labelEn: "Normal",  radius: "rounded-xl",  Icon: RectangleHorizontal },
                    { v: "rounded" as BorderRadius, labelAr: "ناعمة",   labelEn: "Rounded", radius: "rounded-full", Icon: Square },
                  ]).map(({ v, labelAr, labelEn, radius, Icon }) => (
                    <button key={v} onClick={() => updateDisplay({ borderRadius: v })}
                      className={cn("flex flex-col items-center gap-2 py-4 rounded-xl border-2 text-xs font-semibold transition-all",
                        display.borderRadius === v ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground hover:border-primary/40"
                      )}>
                      <div className={`w-10 h-6 border-2 ${display.borderRadius === v ? "border-primary" : "border-current"} ${radius}`} />
                      {isAR ? labelAr : labelEn}
                    </button>
                  ))}
                </div>
              </SectionCard>

              {/* ─ Density ─ */}
              <SectionCard icon={AlignVerticalSpaceAround} title={isAR ? "كثافة العرض (حجم النص)" : "Display Density (Font Size)"} color="bg-teal-500/5">
                <div className="grid grid-cols-3 gap-3">
                  {([
                    { v: "compact"     as Density, labelAr: "مضغوط",   labelEn: "Compact",     Icon: AlignVerticalJustifyStart,  hint: "12.5px" },
                    { v: "normal"      as Density, labelAr: "عادي",    labelEn: "Normal",      Icon: AlignVerticalJustifyCenter, hint: "14px"   },
                    { v: "comfortable" as Density, labelAr: "مريح",    labelEn: "Comfortable", Icon: AlignVerticalSpaceAround,   hint: "15.5px" },
                  ]).map(({ v, labelAr, labelEn, Icon, hint }) => (
                    <button key={v} onClick={() => updateDisplay({ density: v })}
                      className={cn("flex flex-col items-center gap-1.5 py-4 rounded-xl border-2 text-xs font-semibold transition-all",
                        display.density === v ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground hover:border-primary/40"
                      )}>
                      <Icon className="w-3.5 h-3.5" />
                      <span>{isAR ? labelAr : labelEn}</span>
                      <span className="font-mono text-[10px] opacity-60">{hint}</span>
                    </button>
                  ))}
                </div>
              </SectionCard>

              {/* ─ Toggles ─ */}
              <SectionCard icon={Layers} title={isAR ? "خيارات إضافية" : "Extra Options"} color="bg-slate-500/5">
                <div className="space-y-1">
                  {[
                    {
                      field: "sidebarGlass" as const,
                      Icon: Layers,
                      labelAr: "الشريط الجانبي الزجاجي",
                      labelEn: "Glass Sidebar Effect",
                      hintAr: "تأثير شفافية وضبابية على الشريط الجانبي",
                      hintEn: "Frosted glass blur effect on the sidebar",
                    },
                    {
                      field: "animations" as const,
                      Icon: display.animations ? Zap : ZapOff,
                      labelAr: "تأثيرات الحركة",
                      labelEn: "Animations",
                      hintAr: "تفعيل / إيقاف انتقالات وحركات الواجهة",
                      hintEn: "Enable or disable UI transitions and motion effects",
                    },
                  ].map(({ field, Icon, labelAr, labelEn, hintAr, hintEn }) => (
                    <div key={field} className="flex items-center justify-between gap-4 p-3 rounded-xl hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{isAR ? labelAr : labelEn}</p>
                          <p className="text-xs text-muted-foreground">{isAR ? hintAr : hintEn}</p>
                        </div>
                      </div>
                      <button type="button" onClick={() => updateDisplay({ [field]: !display[field] })} className={tog(!!display[field])}>
                        <span className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-transform ${display[field] ? "translate-x-5" : ""}`} />
                      </button>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </div>
            </>
          );
        })()}

        {/* ── Identity Tab ── */}
        {activeTab === "company" && canEditBranding && (
          <Section icon={Building2} title={isAR ? "هوية الشركة" : "Company Identity"} color="bg-blue-500/5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label={isAR ? "اسم الشركة (عربي)" : "Company Name (Arabic)"}>
              <input value={form.nameAr} onChange={e => setForm(p => ({ ...p, nameAr: e.target.value }))} className={inp} placeholder="اسم الشركة بالعربي" />
            </Field>
            
            <Field label={isAR ? "اسم الشركة (إنجليزي)" : "Company Name (English)"}>
              <input value={form.nameEn} onChange={e => setForm(p => ({ ...p, nameEn: e.target.value }))} className={inp} placeholder="Enter company name in English" />
            </Field>
            
            <Field label={isAR ? "الترجمة الثانوية (عربي)" : "Subtitle (Arabic)"}>
              <input value={form.subtitleAr} onChange={e => setForm(p => ({ ...p, subtitleAr: e.target.value }))} className={inp} placeholder="الترجمة الثانوية بالعربي" />
            </Field>
            
            <Field label={isAR ? "الترجمة الثانوية (إنجليزي)" : "Subtitle (English)"}>
              <input value={form.subtitleEn} onChange={e => setForm(p => ({ ...p, subtitleEn: e.target.value }))} className={inp} placeholder="Enter subtitle in English" />
            </Field>
            
            <Field label={isAR ? "الوصف (عربي)" : "Tagline (Arabic)"}>
              <input value={form.taglineAr} onChange={e => setForm(p => ({ ...p, taglineAr: e.target.value }))} className={inp} placeholder="وصف النشاط بالعربي" />
            </Field>
            
            <Field label={isAR ? "الوصف (إنجليزي)" : "Tagline (English)"}>
              <input value={form.taglineEn} onChange={e => setForm(p => ({ ...p, taglineEn: e.target.value }))} className={inp} placeholder="Enter business description in English" />
            </Field>
            </div>
          </Section>
        )}

        {/* ── Contact Tab ── */}
        {activeTab === "company" && canEditLegalInfo &&(
          <Section icon={Phone} title={isAR ? "معلومات التواصل" : "Contact Information"} color="bg-green-500/5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label={isAR ? "البريد الإلكتروني" : "Email"}>
                <div className="relative">
                  <Mail className="absolute top-2.5 start-3 w-3.5 h-3.5 text-muted-foreground" />
                  <input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} className={`${inp} ps-9`} placeholder={isAR ? "أدخل البريد الإلكتروني" : "Enter email address"} type="email" />
                </div>
              </Field>
              <Field label={isAR ? "رقم الهاتف" : "Phone"}>
                <div className="relative">
                  <Phone className="absolute top-2.5 start-3 w-3.5 h-3.5 text-muted-foreground" />
                  <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} className={`${inp} ps-9`} placeholder={isAR ? "أدخل رقم الهاتف" : "Enter phone number"} />
                </div>
              </Field>
              <Field label={isAR ? "العنوان" : "Address"}>
                <div className="relative">
                  <MapPin className="absolute top-2.5 start-3 w-3.5 h-3.5 text-muted-foreground" />
                  <input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} className={`${inp} ps-9`} placeholder={isAR ? "أدخل عنوان الشركة" : "Enter company address"} />
                </div>
              </Field>
              <Field label={isAR ? "صندوق البريد" : "P.O Box"}>
                <input value={form.poBox} onChange={e => setForm(p => ({ ...p, poBox: e.target.value }))} className={inp} placeholder={isAR ? "أدخل صندوق البريد" : "Enter P.O Box"} />
              </Field>
              <Field label={isAR ? "الموقع الإلكتروني" : "Website"}>
                <div className="relative">
                  <Globe className="absolute top-2.5 start-3 w-3.5 h-3.5 text-muted-foreground" />
                  <input value={form.website} onChange={e => setForm(p => ({ ...p, website: e.target.value }))} className={`${inp} ps-9`} placeholder={isAR ? "أدخل الموقع الإلكتروني" : "Enter website"} />
                </div>
              </Field>
            </div>
          </Section>
        )}

        {/* ── Legal Tab ── */}
        {activeTab === "company" && canEditLegalInfo && (
          <Section icon={Hash} title={isAR ? "القانونية والنسخ" : "Legal & Backup"} color="bg-amber-500/5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label={isAR ? "رقم السجل التجاري" : "Commercial Registration No."}>
                <div className="relative">
                  <Hash className="absolute top-2.5 start-3 w-3.5 h-3.5 text-muted-foreground" />
                  <input value={form.crNumber} onChange={e => setForm(p => ({ ...p, crNumber: e.target.value }))} className={`${inp} ps-9`} placeholder="12345678" />
                </div>
              </Field>
              <Field label={isAR ? "الرقم الضريبي" : "Tax / VAT Number"}>
                <div className="relative">
                  <Hash className="absolute top-2.5 start-3 w-3.5 h-3.5 text-muted-foreground" />
                  <input value={form.taxNumber} onChange={e => setForm(p => ({ ...p, taxNumber: e.target.value }))} className={`${inp} ps-9`} placeholder="VAT-123456" />
                </div>
              </Field>
            </div>

          </Section>
        )}

        {/* ── Branding Tab ── */}
        {activeTab === "branding" && (canEditLogo || canEditStamp || canEditAccountantSignature || canEditBranding) && (
          <Section icon={Image} title={isAR ? "الشعار والختم والعلامة المائية" : "Logo, Stamp & Watermark"} color="bg-purple-500/5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Logo */}
              {canEditLogo && <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{isAR ? "شعار الشركة" : "Company Logo"}</p>
                <div className="flex flex-col items-center justify-center gap-3 p-4 border-2 border-dashed border-border rounded-xl bg-muted/20 hover:bg-muted/30 transition-colors min-h-[160px]">
                  <img src={currentLogoSrc} alt="logo" className="h-16 w-auto object-contain" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                  <div className="flex gap-2 flex-wrap justify-center">
                    <button type="button" onClick={() => logoRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition">
                      <Upload className="w-3.5 h-3.5" /> {isAR ? "رفع شعار" : "Upload"}
                    </button>
                    {logoPreview && (
                      <button type="button" onClick={() => { setLogoPreview(null); setForm(p => ({ ...p, logoBase64: null })); }} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-muted rounded-lg hover:bg-muted-foreground/20 transition">
                        <RotateCcw className="w-3.5 h-3.5" /> {isAR ? "حذف" : "Remove"}
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground text-center">{isAR ? "PNG/JPG · أقصى 2 MB" : "PNG/JPG · Max 2 MB"}</p>
                </div>
                <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e, "logoBase64", setLogoPreview)} />
              
                 <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">
                    {isAR ? "حجم الشعار" : "Logo Size"}
                  </label>
                  <input
                    type="number"
                    min="40"
                    max="200"
                    value={form.logoSize || 80}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, logoSize: Number(e.target.value) }))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                  />
                </div>   
              
              </div>}
              {/* Stamp */}
              {canEditStamp && <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{isAR ? "ختم الشركة" : "Company Stamp"}</p>
                <div className="flex flex-col items-center justify-center gap-3 p-4 border-2 border-dashed border-border rounded-xl bg-muted/20 hover:bg-muted/30 transition-colors min-h-[160px]">
                  <img src={currentStampSrc} alt="stamp" className="h-16 w-auto object-contain" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                  <div className="flex gap-2 flex-wrap justify-center">
                    <button type="button" onClick={() => stampRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition">
                      <Upload className="w-3.5 h-3.5" /> {isAR ? "رفع ختم" : "Upload"}
                    </button>
                    {stampPreview && (
                      <button type="button" onClick={() => { setStampPreview(null); setForm(p => ({ ...p, stampBase64: null })); }} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-muted rounded-lg hover:bg-muted-foreground/20 transition">
                        <RotateCcw className="w-3.5 h-3.5" /> {isAR ? "حذف" : "Remove"}
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground text-center">{isAR ? "PNG شفاف · أقصى 2 MB" : "Transparent PNG · Max 2 MB"}</p>
                </div>
                <input ref={stampRef} type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e, "stampBase64", setStampPreview)} />
              </div>}
              
                {/* Accountant Signature */}
                {canEditAccountantSignature && <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {isAR ? "توقيع المحاسب" : "Accountant Signature"}
                </p>

                <div className="flex flex-col items-center justify-center gap-3 p-4 border-2 border-dashed border-border rounded-xl bg-muted/20 hover:bg-muted/30 transition-colors min-h-[160px]">
                  <img
                    src={accountantSignaturePreview || ""}
                    alt="accountant-signature"
                    className="h-16 w-auto object-contain"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />

                  <div className="flex gap-2 flex-wrap justify-center">
                    <button
                      type="button"
                      onClick={() => accountantSignatureRef.current?.click()}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      {isAR ? "رفع توقيع" : "Upload"}
                    </button>

                    {accountantSignaturePreview && (
                      <button
                        type="button"
                        onClick={() => {
                          setAccountantSignaturePreview(null);
                          setForm((p) => ({ ...p, accountantSignatureBase64: null }));
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-muted rounded-lg hover:bg-muted-foreground/20 transition"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        {isAR ? "حذف" : "Remove"}
                      </button>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground text-center">
                    {isAR ? "PNG شفاف · أقصى 2 MB" : "Transparent PNG · Max 2 MB"}
                  </p>
                </div>

                <input
                  ref={accountantSignatureRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleImageUpload(e, "accountantSignatureBase64", setAccountantSignaturePreview)}
                />
              </div>}

              {canEditAccountantSignature && <div className="flex items-center justify-between gap-4 p-3 rounded-xl hover:bg-muted/30 transition-colors">
                <span className="text-sm font-medium">
                  {isAR ? "إظهار توقيع المحاسب" : "Show Accountant Signature"}
                </span>
                <Toggle field="showAccountantSignature" />
              </div>}

              {/* Watermark */}
              {canEditBranding && <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{isAR ? "العلامة المائية" : "Watermark"}</p>
                <div className="flex flex-col items-center justify-center gap-3 p-4 border-2 border-dashed border-purple-400/40 rounded-xl bg-purple-500/5 hover:bg-purple-500/10 transition-colors min-h-[160px]">
                  <img src={currentWatermarkSrc} alt="watermark" className="h-16 w-auto object-contain opacity-40" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                  <div className="flex gap-2 flex-wrap justify-center">
                    <button type="button" onClick={() => watermarkRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-purple-600 text-white rounded-lg hover:opacity-90 transition">
                      <Upload className="w-3.5 h-3.5" /> {isAR ? "رفع واترمارك" : "Upload"}
                    </button>
                    {watermarkPreview && (
                      <button type="button" onClick={() => { setWatermarkPreview(null); setForm(p => ({ ...p, watermarkBase64: null })); }} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-muted rounded-lg hover:bg-muted-foreground/20 transition">
                        <RotateCcw className="w-3.5 h-3.5" /> {isAR ? "حذف" : "Remove"}
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground text-center">{isAR ? "خلفية شفافة في الطباعة · يُستخدم الشعار بديلاً" : "Transparent print background · Falls back to logo"}</p>
                </div>
                <input ref={watermarkRef} type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e, "watermarkBase64", setWatermarkPreview)} />
              </div>}
            </div>
          </Section>
        )}

          {/* ── Print Tab ── */}
          {activeTab === "print" && canEditPrintSettings && (
            <Section icon={Printer} title={isAR ? "خيارات الطباعة" : "Print Options"} color="bg-rose-500/5">
              <div className="space-y-4">

                {/* Invoice Preview */}
                <div
                  className="bg-white rounded-xl shadow-inner border border-gray-200 overflow-hidden mb-4 p-4 space-y-4"
                  style={{ fontFamily: "'Cairo', sans-serif" }}
                >
                  <InvoicePrintHeader
                    company={form}
                    logoSrc={currentLogoSrc}
                    isAR={isAR}
                    invoiceNumber="INV-PREVIEW"
                    statusText="مسودة"
                  />

                  {/* Footer preview */}
                  {form.footerText && (
                    <div className="text-center text-xs text-gray-500 border-t pt-2">
                      {form.footerText}
                    </div>
                  )}

                  {/* Stamp preview */}
                  {form.showStampOnInvoices && form.stampBase64 && (
                    <div className="flex justify-center pt-3">
                      <img
                        src={form.stampBase64}
                        alt="stamp"
                        className="h-16 opacity-90 object-contain drop-shadow-sm"
                      />
                    </div>
                  )}
                </div>

                {[
                  { field: "showWatermark" as const, labelAr: "إظهار العلامة المائية في صفحات الطباعة", labelEn: "Show watermark on print pages", icon: Eye },
                  { field: "showStampOnInvoices" as const, labelAr: "إظهار الختم على الفواتير", labelEn: "Show stamp on invoices", icon: Stamp },
                  { field: "showStampOnReceipts" as const, labelAr: "إظهار الختم على سندات القبض", labelEn: "Show stamp on receipts", icon: Stamp },
                  { field: "showStampOnStatements" as const, labelAr: "إظهار الختم على كشوف الحساب", labelEn: "Show stamp on statements", icon: Stamp },
                ].map(({ field, labelAr, labelEn, icon: Icon }) => (
                  <div key={field} className="flex items-center justify-between gap-4 p-3 rounded-xl hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                      <span className="text-sm font-medium">{isAR ? labelAr : labelEn}</span>
                    </div>
                    <Toggle field={field} />
                  </div>
                ))}

                <Field label={isAR ? "عنوان الفاتورة الأساسي" : "Main Invoice Title"}>
                  <input
                    value={form.invoiceCreditTitleAr}
                    onChange={e => setForm(p => ({ ...p, invoiceCreditTitleAr: e.target.value }))}
                    className={inp}
                  />
                </Field>

                <Field label={isAR ? "عنوان الفاتورة الفرعي" : "Sub Invoice Title"}>
                  <input
                    value={form.invoiceCreditTitleEn}
                    onChange={e => setForm(p => ({ ...p, invoiceCreditTitleEn: e.target.value }))}
                    className={inp}
                  />
                </Field>

                <Field label={isAR ? "حجم عنوان الفاتورة" : "Invoice Title Font Size"}>
                  <input
                    type="number"
                    value={form.invoiceTitleFontSize}
                    onChange={e => setForm(p => ({ ...p, invoiceTitleFontSize: Number(e.target.value) }))}
                    className={inp}
                  />
                </Field>

                <TitleOptionsGrid
                  title={isAR ? "خصائص عنوان الفاتورة" : "Invoice Title Properties"}
                  isAR={isAR}
                  value={{
                    enabled: !!form.invoiceTitleVisible,
                    align: form.invoiceTitleAlign || "center",
                    bold: !!form.invoiceTitleBold,
                    subtitleAr: form.invoiceSubtitleAr || "",
                    subtitleEn: form.invoiceSubtitleEn || "",
                    subtitleSize: Number(form.invoiceSubtitleFontSize ?? 12),
                  }}
                  onChange={(next) =>
                    setForm((p) => ({
                      ...p,
                      invoiceTitleVisible: next.enabled,
                      invoiceTitleAlign: next.align,
                      invoiceTitleBold: next.bold,
                      invoiceSubtitleAr: next.subtitleAr,
                      invoiceSubtitleEn: next.subtitleEn,
                      invoiceSubtitleFontSize: next.subtitleSize,
                    }))
                  }
                />

                <div className="space-y-2">
                  <div className="text-xs font-bold text-muted-foreground">
                    {isAR ? "عنوان كشف الحساب" : "Statement Title"}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <Field label={isAR ? "عربي" : "Arabic"}>
                      <input
                        value={form.statementTitleAr}
                        onChange={e => setForm(p => ({ ...p, statementTitleAr: e.target.value }))}
                        className={inp}
                      />
                    </Field>

                    <Field label="English">
                      <input
                        value={form.statementTitleEn}
                        onChange={e => setForm(p => ({ ...p, statementTitleEn: e.target.value }))}
                        className={inp}
                      />
                    </Field>

                    <Field label={isAR ? "الحجم" : "Size"}>
                      <input
                        type="number"
                        value={form.statementTitleFontSize}
                        onChange={e => setForm(p => ({ ...p, statementTitleFontSize: Number(e.target.value) }))}
                        className={inp}
                      />
                    </Field>
                  </div>
                </div>

                <TitleOptionsGrid
                  title={isAR ? "خصائص عنوان كشف الحساب" : "Statement Title Properties"}
                  isAR={isAR}
                  value={{
                    enabled: !!form.statementTitleVisible,
                    align: form.statementTitleAlign || "center",
                    bold: !!form.statementTitleBold,
                    subtitleAr: form.statementSubtitleAr || "",
                    subtitleEn: form.statementSubtitleEn || "",
                    subtitleSize: Number(form.statementSubtitleFontSize ?? 12),
                  }}
                  onChange={(next) =>
                    setForm((p) => ({
                      ...p,
                      statementTitleVisible: next.enabled,
                      statementTitleAlign: next.align,
                      statementTitleBold: next.bold,
                      statementSubtitleAr: next.subtitleAr,
                      statementSubtitleEn: next.subtitleEn,
                      statementSubtitleFontSize: next.subtitleSize,
                    }))
                  }
                />

                <div className="space-y-2">
                  <div className="text-xs font-bold text-muted-foreground">
                    {isAR ? "عنوان ملخص العميل المالي" : "Customer Financial Summary Title"}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <Field label={isAR ? "عربي" : "Arabic"}>
                      <input
                        value={form.customerLedgerTitleAr}
                        onChange={e => setForm(p => ({ ...p, customerLedgerTitleAr: e.target.value }))}
                        className={inp}
                      />
                    </Field>

                    <Field label="English">
                      <input
                        value={form.customerLedgerTitleEn}
                        onChange={e => setForm(p => ({ ...p, customerLedgerTitleEn: e.target.value }))}
                        className={inp}
                      />
                    </Field>

                    <Field label={isAR ? "الحجم" : "Size"}>
                      <input
                        type="number"
                        value={form.customerLedgerTitleFontSize}
                        onChange={e => setForm(p => ({ ...p, customerLedgerTitleFontSize: Number(e.target.value) }))}
                        className={inp}
                      />
                    </Field>
                  </div>
                </div>

                <TitleOptionsGrid
                  title={isAR ? "خصائص عنوان ملخص العميل المالي" : "Customer Financial Summary Title Properties"}
                  isAR={isAR}
                  value={{
                    enabled: !!form.customerLedgerTitleVisible,
                    align: form.customerLedgerTitleAlign || "center",
                    bold: !!form.customerLedgerTitleBold,
                    subtitleAr: form.customerLedgerSubtitleAr || "",
                    subtitleEn: form.customerLedgerSubtitleEn || "",
                    subtitleSize: Number(form.customerLedgerSubtitleFontSize ?? 12),
                  }}
                  onChange={(next) =>
                    setForm((p) => ({
                      ...p,
                      customerLedgerTitleVisible: next.enabled,
                      customerLedgerTitleAlign: next.align,
                      customerLedgerTitleBold: next.bold,
                      customerLedgerSubtitleAr: next.subtitleAr,
                      customerLedgerSubtitleEn: next.subtitleEn,
                      customerLedgerSubtitleFontSize: next.subtitleSize,
                    }))
                  }
                />

                <Field
                  label={isAR ? "نص التذييل في صفحات الطباعة" : "Footer text on print pages"}
                  hint={isAR ? "يظهر في أسفل كل فاتورة وسند" : "Appears at the bottom of each invoice and receipt"}
                >
                  <textarea
                    value={form.footerText}
                    onChange={e => setForm(p => ({ ...p, footerText: e.target.value }))}
                    rows={3}
                    className={`${inp} resize-none`}
                    placeholder={isAR ? "مثال: شكراً لتعاملكم معنا · جميع الأسعار شاملة الضريبة" : "e.g. Thank you for your business"}
                  />
                </Field>
              </div>
            </Section>
          )}
          {/* Info banner */}
          {activeTab !== "preview" && (
            <div className="flex items-start gap-3 p-4 bg-blue-500/5 border border-blue-500/20 rounded-2xl text-sm text-blue-700 dark:text-blue-300">
              <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <p>
                {isAR
                  ? "جميع التغييرات تُطبَّق فوراً في كامل البرنامج وصفحات الطباعة عند الحفظ دون الحاجة لإعادة تشغيل."
                  : "All changes are applied instantly across the entire app and print pages upon saving — no restart needed."}
              </p>
            </div>
          )}

          </div>
        </motion.div>
      );
    }
