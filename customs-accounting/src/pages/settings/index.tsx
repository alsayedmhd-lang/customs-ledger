import ResizableScrollArea from "@/components/layout/ResizableScrollArea";
import InvoicePrintHeader from "@/components/invoice-print-header";
import {
  PrintDocumentFooter,
  PrintTitleBlock,
  PrintSignaturesStamp,
  PrintWatermark,
  ReceiptPrintHeader,
  StatementPrintHeader,
  StatementStamp,
} from "@/components/print-document-parts";
import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import SettingsShell from "@/components/layout/SettingsShell";
import DeviceIdentitySettings from "@/components/DeviceIdentitySettings";
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
  Wallpaper, SlidersHorizontal, Ban, Blend,
} from "lucide-react";
import { useDisplaySettings, COLOR_PRESETS, SIDEBAR_COLOR_PRESETS, type PrimaryColor, type BorderRadius, type Density, type SidebarColor, type BgType } from "@/lib/display-settings-context";

type TabId = "preview" | "backup" | "company" | "branding" | "print" | "display" | "update" | "devices";
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
    <section className="w-full min-w-0 space-y-4">
      <div className={`flex items-center gap-2 rounded-xl px-4 py-3 ${color}`}>
        <Icon className="w-4 h-4 shrink-0" />
        <h2 className="text-base font-semibold">{title}</h2>
      </div>
      <div className={cn("w-full min-w-0", contentClassName)}>{children}</div>
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-muted-foreground">{label}</label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function DocumentTitleEditor({ prefix, titlePrefix = prefix, label, isAR, form, setForm }: {
  prefix: "invoice" | "receipt" | "statement" | "customerLedger";
  titlePrefix?: string; label: string; isAR: boolean; form: any;
  setForm: React.Dispatch<React.SetStateAction<any>>;
}) {
  const defaults = DEFAULT_SETTINGS as any;
  const read = (suffix: string) => form[prefix + suffix] ?? defaults[prefix + suffix];
  const titleAr = form[titlePrefix + "TitleAr"] ?? defaults[titlePrefix + "TitleAr"] ?? "";
  const titleEn = form[titlePrefix + "TitleEn"] ?? defaults[titlePrefix + "TitleEn"] ?? "";
  const set = (key: string, value: unknown) => setForm((current: any) => ({ ...current, [key]: value }));
  const size = (value: string) => Math.max(8, Math.min(48, Number(value) || 8));
  return (
    <div className="space-y-5">
      <h3 className="text-base font-semibold">{label}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label={isAR ? "نص العنوان بالعربية" : "Arabic title text"}>
          <input value={titleAr} dir="rtl" onChange={e => set(titlePrefix + "TitleAr", e.target.value)} className={inp} />
        </Field>
        <Field label={isAR ? "نص العنوان بالإنجليزية" : "English title text"}>
          <input value={titleEn} dir="ltr" onChange={e => set(titlePrefix + "TitleEn", e.target.value)} className={inp} />
        </Field>
        <Field label={isAR ? "حجم خط العنوان العربي" : "Arabic title font size"}>
          <input type="number" min={8} max={48} value={read("TitleFontSize")} onChange={e => set(prefix + "TitleFontSize", size(e.target.value))} className={inp} />
        </Field>
        <Field label={isAR ? "حجم خط العنوان الإنجليزي" : "English title font size"}>
          <input type="number" min={8} max={48} value={read("TitleEnFontSize")} onChange={e => set(prefix + "TitleEnFontSize", size(e.target.value))} className={inp} />
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <label className="flex min-h-10 items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
          <input type="checkbox" checked={!!read("TitleVisible")} onChange={e => set(prefix + "TitleVisible", e.target.checked)} className="h-4 w-4 accent-primary" />
          {isAR ? "إظهار العنوان" : "Show title"}
        </label>
        <Field label={isAR ? "المحاذاة" : "Alignment"}>
          <select value={read("TitleAlign")} onChange={e => set(prefix + "TitleAlign", e.target.value)} className={inp}>
            <option value="right">{isAR ? "يمين" : "Right"}</option>
            <option value="center">{isAR ? "وسط" : "Center"}</option>
            <option value="left">{isAR ? "يسار" : "Left"}</option>
          </select>
        </Field>
        <label className="flex min-h-10 items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
          <input type="checkbox" checked={!!read("TitleBold")} onChange={e => set(prefix + "TitleBold", e.target.checked)} className="h-4 w-4 accent-primary" />
          {isAR ? "خط عريض" : "Bold title"}
        </label>
      </div>
      <details className="rounded-xl border border-border bg-background">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium">{isAR ? "سطر إضافي تحت العنوان (اختياري)" : "Additional subtitle (optional)"}</summary>
        <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_120px] gap-4 p-4 pt-0">
          <Field label={isAR ? "السطر الإضافي بالعربية" : "Arabic subtitle"}>
            <input value={read("SubtitleAr") || ""} dir="rtl" onChange={e => set(prefix + "SubtitleAr", e.target.value)} placeholder={isAR ? "لا يظهر عند تركه فارغًا" : "Hidden when empty"} className={inp} />
          </Field>
          <Field label={isAR ? "السطر الإضافي بالإنجليزية" : "English subtitle"}>
            <input value={read("SubtitleEn") || ""} dir="ltr" onChange={e => set(prefix + "SubtitleEn", e.target.value)} placeholder={isAR ? "لا يظهر عند تركه فارغًا" : "Hidden when empty"} className={inp} />
          </Field>
          <Field label={isAR ? "حجم الخط" : "Font size"}>
            <input type="number" min={8} max={48} value={read("SubtitleFontSize")} onChange={e => set(prefix + "SubtitleFontSize", size(e.target.value))} className={inp} />
          </Field>
        </div>
      </details>
      <div className="rounded-xl border border-border bg-muted/20 p-4">
        <p className="mb-3 text-sm font-medium text-muted-foreground">{isAR ? "معاينة مباشرة للنص وحجم الخط" : "Live text and font size preview"}</p>
        <div className="rounded-lg border border-gray-200 bg-white p-5 text-gray-900 overflow-auto">
          {read("TitleVisible") ? <PrintTitleBlock visible align={read("TitleAlign")} bold={!!read("TitleBold")} titleAr={titleAr} titleEn={titleEn} titleFontSize={Number(read("TitleFontSize"))} titleEnFontSize={Number(read("TitleEnFontSize"))} subtitleAr={read("SubtitleAr")} subtitleEn={read("SubtitleEn")} subtitleFontSize={Number(read("SubtitleFontSize"))} /> : <p className="text-center text-sm text-gray-500">{isAR ? "العنوان مخفي في الطباعة" : "Title hidden in print"}</p>}
        </div>
      </div>
    </div>
  );
}

function PreviewShell({
  id,
  title,
  fitLabel,
  size,
  scale,
  activePreview,
  savedWidth,
  savedHeight,
  onSelect,
  onWidthChange,
  onHeightChange,
  onFitHeight,
  children,
}: {
  id?: string;
  title: string;
  fitLabel: string;
  size: "large" | "medium" | "small";
  scale: number;
  activePreview?: string;
  savedWidth?: number;
  savedHeight?: number;
  onSelect?: (id: string) => void;
  onWidthChange?: (id: string, width: number) => void;
  onHeightChange?: (id: string, height: number) => void;
  onFitHeight?: (id: string) => void;
  children: React.ReactNode;
}) {
  const shellRef = useRef<HTMLDivElement>(null);
  const documentRef = useRef<HTMLDivElement>(null);
  const startSizeRef = useRef<{ width: number; height: number } | null>(null);
  const isInteractive = !!id && !!activePreview;
  const isMain = isInteractive ? id === activePreview : size === "large";
  const preview = {
    large: {
      sourceWidth: 1120,
      sourceHeight: 900,
    },
    medium: {
      sourceWidth: 840,
      sourceHeight: 700,
    },
    small: {
      sourceWidth: 840,
      sourceHeight: 720,
    },
  }[size];
  const scaledWidth = Math.ceil(preview.sourceWidth * scale);
  const [contentHeight, setContentHeight] = useState(preview.sourceHeight);
  useEffect(() => {
    const document = documentRef.current;
    if (!document) return;
    const measure = () => setContentHeight(document.scrollHeight || preview.sourceHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(document);
    return () => observer.disconnect();
  }, [preview.sourceHeight]);
  const scaledHeight = Math.ceil(contentHeight * scale);
  const fittedHeight = Math.min(1200, Math.max(isMain ? 360 : 260, scaledHeight + 47));
  const handleSaveSize = () => {
    if (!shellRef.current || !id) return;
    const width = Math.round(shellRef.current.offsetWidth);
    const height = Math.round(shellRef.current.offsetHeight);
    const start = startSizeRef.current;
    startSizeRef.current = null;
    if (!start || (width === start.width && height === start.height)) return;
    if (width !== start.width) onWidthChange?.(id, width);
    if (height !== start.height) onHeightChange?.(id, height);
  };

  return (
    <div
      ref={shellRef}
      title="Drag the bottom corner to resize the preview"
      draggable={isInteractive && !isMain}
      onClick={() => id && !isMain && onSelect?.(id)}
      onDragStart={(e) => id && e.dataTransfer.setData("text/plain", id)}
      onDragOver={(e) => isMain && e.preventDefault()}
      onDrop={(e) => {
        if (!isMain) return;
        const next = e.dataTransfer.getData("text/plain");
        if (next) onSelect?.(next);
      }}
      onMouseUp={handleSaveSize}
      onTouchEnd={handleSaveSize}
      onPointerDown={() => {
        if (shellRef.current) {
          startSizeRef.current = {
            width: Math.round(shellRef.current.offsetWidth),
            height: Math.round(shellRef.current.offsetHeight),
          };
        }
      }}
      className={cn(
        "min-w-[320px] min-h-[260px] rounded-xl border border-border bg-muted/20 overflow-hidden",
        isInteractive && !isMain && "cursor-pointer transition hover:border-primary/60 hover:shadow-md",
        isMain && "shadow-sm"
      )}
      style={{
        order: isMain ? 0 : 1,
        flex: "0 0 auto",
        width: savedWidth ? savedWidth : isMain ? "100%" : "min(100%, 420px)",
        maxWidth: "none",
        resize: "both",
        height: savedHeight ?? fittedHeight,
        minHeight: isMain ? 360 : 260,
      }}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-card">
        <h3 className="text-sm font-bold text-foreground">{title}</h3>
        <div className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground">
          {savedHeight && id && (
            <button
              type="button"
              className="rounded border border-border px-2 py-0.5 hover:text-foreground"
              onClick={(event) => { event.stopPropagation(); onFitHeight?.(id); }}
            >
              {fitLabel}
            </button>
          )}
          <span>↔ ↕ {savedWidth ? `${Math.round(savedWidth)} px` : "Resize"}</span>
        </div>
      </div>
      <div
        className="overflow-auto bg-slate-100 p-1"
        style={{
          height: "calc(100% - 37px)",
          minHeight: 0,
          maxHeight: "none",
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
            ref={documentRef}
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
  customerLedgerPreviewScale,
}: {
  settings: CompanySettings;
  logoSrc: string;
  stampSrc: string;
  watermarkSrc: string;
  isAR: boolean;
  invoicePreviewScale: number;
  receiptPreviewScale: number;
  statementPreviewScale: number;
  customerLedgerPreviewScale: number;
}) {
  const override = { settings, logoSrc, stampSrc, watermarkSrc };
  const receiverSignature = settings.receiverSignatureBase64;
  const today = formatDateYMD();
  const previewStorageKey = "settings_preview_active";
  const previewWidthsStorageKey = "settings_preview_document_widths";
  const previewHeightsStorageKey = "settings_preview_document_heights";
  const [activePreview, setActivePreviewState] = useState(() => {
    try {
      return localStorage.getItem(previewStorageKey) || "invoice";
    } catch {
      return "invoice";
    }
  });
  const [documentWidths, setDocumentWidths] = useState<Record<string, number>>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(previewWidthsStorageKey) || "{}");
      return Object.fromEntries(
        ["invoice", "receipt", "statement", "summary"]
          .filter((id) => Number.isFinite(Number(saved[id])) && Number(saved[id]) >= 320)
          .map((id) => [id, Math.min(1800, Number(saved[id]))]),
      );
    } catch {
      return {};
    }
  });
  const [documentHeights, setDocumentHeights] = useState<Record<string, number>>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(previewHeightsStorageKey) || "{}");
      return Object.fromEntries(
        ["invoice", "receipt", "statement", "summary"]
          .filter((id) => Number.isFinite(Number(saved[id])) && Number(saved[id]) >= 260)
          .map((id) => [id, Math.min(1200, Number(saved[id]))]),
      );
    } catch {
      return {};
    }
  });
  const setDocumentWidth = (id: string, width: number) => {
    if (!Number.isFinite(width)) return;
    setDocumentWidths((previous) => {
      const nextWidth = Math.min(1800, Math.max(320, width));
      if (previous[id] === nextWidth) return previous;
      const next = { ...previous, [id]: nextWidth };
      try { localStorage.setItem(previewWidthsStorageKey, JSON.stringify(next)); } catch {}
      return next;
    });
  };
  const setDocumentHeight = (id: string, height: number) => {
    if (!Number.isFinite(height)) return;
    setDocumentHeights((previous) => {
      const nextHeight = Math.min(1200, Math.max(260, height));
      if (previous[id] === nextHeight) return previous;
      const next = { ...previous, [id]: nextHeight };
      try { localStorage.setItem(previewHeightsStorageKey, JSON.stringify(next)); } catch {}
      return next;
    });
  };
  const fitDocumentHeight = (id: string) => {
    setDocumentHeights((previous) => {
      const next = { ...previous };
      delete next[id];
      try { localStorage.setItem(previewHeightsStorageKey, JSON.stringify(next)); } catch {}
      return next;
    });
  };
  const setActivePreview = (id: string) => {
    setActivePreviewState(id);
    try { localStorage.setItem(previewStorageKey, id); } catch {}
  };
  const previewShellProps = (id: string) => ({
    id,
    fitLabel: isAR ? "ملاءمة الارتفاع" : "Fit height",
    activePreview,
    savedWidth: documentWidths[id],
    savedHeight: documentHeights[id],
    onSelect: setActivePreview,
    onWidthChange: setDocumentWidth,
    onHeightChange: setDocumentHeight,
    onFitHeight: fitDocumentHeight,
  });

  return (
    <div className="w-full max-w-none space-y-4">
      <div className="flex w-full flex-wrap items-start gap-4 overflow-x-auto pb-2">
      <PreviewShell {...previewShellProps("invoice")} title={isAR ? "معاينة الفاتورة" : "Invoice Preview"} size="large" scale={invoicePreviewScale}>
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
                    <div className="text-[9px] font-bold text-gray-400 r">{row[0]}</div>
                    <div className="text-[13px] leading-tight font-bold text-gray-900">{row[1]}</div>
                  </div>
                  <div className="px-5 py-1.5">
                    <div className="text-[9px] font-bold text-gray-400 r">{row[2]}</div>
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

        <PreviewShell {...previewShellProps("receipt")} title={isAR ? "معاينة سند القبض" : "Receipt Preview"} size="medium" scale={receiptPreviewScale}>
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

        <PreviewShell {...previewShellProps("statement")} title={isAR ? "معاينة كشف الحساب" : "Customer Statement Preview"} size="small" scale={statementPreviewScale}>
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
                  <p className="text-xs font-bold text-gray-500 r mb-2">بيانات العميل / CLIENT DETAILS</p>
                  <p className="text-base font-black text-gray-900">{isAR ? "عميل تجريبي" : "Sample Client"}</p>
                  <p className="text-sm text-gray-600 mt-0.5">{isAR ? "الدوحة، قطر" : "Doha, Qatar"}</p>
                </div>
                <div className="border-2 border-gray-700 rounded text-sm">
                  <div className="bg-gray-800 text-white text-center py-1 font-bold text-xs st">ملخص الحساب / ACCOUNT SUMMARY</div>
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

        <PreviewShell {...previewShellProps("summary")} title={isAR ? "معاينة ملخص العميل المالي" : "Customer Financial Summary Preview"} size="small" scale={customerLedgerPreviewScale}>
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
                  <p className="text-xs font-bold text-gray-500 r mb-2">بيانات العميل / CLIENT DETAILS</p>
                  <p className="text-base font-black text-gray-900">{isAR ? "عميل تجريبي" : "Sample Client"}</p>
                  <p className="text-sm text-gray-600 mt-0.5">{isAR ? "الدوحة، قطر" : "Doha, Qatar"}</p>
                </div>
                <div className="border-2 border-gray-700 rounded text-sm">
                  <div className="bg-gray-800 text-white text-center py-1 font-bold text-xs st">ملخص الحساب / ACCOUNT SUMMARY</div>
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

const inp = "w-full min-h-10 px-3 py-2 text-sm bg-background border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/20 transition-colors";
const tog = (on: boolean) =>
  `relative w-11 h-6 rounded-full transition-colors cursor-pointer ${on ? "bg-primary" : "bg-muted-foreground/30"}`;
const previewZoomStorageKeys = {
  invoice: "settings_preview_invoice_zoom",
  receipt: "settings_preview_receipt_zoom",
  statement: "settings_preview_statement_zoom",
  customerLedger: "settings_preview_customer_ledger_zoom",
} as const;

const readPreviewZoom = (key: string, fallback: number) => {
  try {
    const saved = Number(localStorage.getItem(key));
    return Number.isFinite(saved) && saved > 0 ? saved : fallback;
  } catch {
    return fallback;
  }
};

const writePreviewZoom = (key: string, value: number) => {
  try {
    localStorage.setItem(key, String(value));
  } catch {}
};

export default function SettingsPage() {
  const [, setLocation] = useLocation();
  const openDeveloperSettings = () => setLocation("/settings/developer");
  const { user, isDeveloperSupportMode } = useAuth();
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
  const developerVersionTapRef = useRef({ count: 0, lastTapAt: 0 });
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
  const roleCanEdit = user?.role === "admin" || isDeveloperSupportMode;
  const canViewAllSettingsTabs =
    user?.role === "admin" || user?.role === "manager" || isDeveloperSupportMode;
  const canEditAccountantSignature = roleCanEdit || allowManagerEditAccountantSignature;
  const canEditAppearance = true;
  const canEditBranding =
    (roleCanEdit || allowManagerEditBranding || allowManagerEditAppearance) &&
    (!lockCompanyIdentity || isDeveloperSupportMode);
  const canEditCompanyName = canEditBranding && (!lockCompanyName || isDeveloperSupportMode);
  const canEditLogo = canEditBranding && (!lockLogo || isDeveloperSupportMode);
  const canEditStamp = canEditBranding && (!lockStamp || isDeveloperSupportMode);
  const canEditLegalInfo =
    (roleCanEdit || allowManagerEditLegalInfo) && (!lockLegalInfo || isDeveloperSupportMode);
  const canEditPrintSettings =
    (roleCanEdit || allowManagerEditPrintSettings) && (!lockFooterBranding || isDeveloperSupportMode);
  const canEditBrandIdentity = canEditBranding;
  const canUseInvoicesBackupImport = roleCanEdit || allowManagerEditInvoicesBackupImport;
  const [activeTab, setActiveTab] = useState<TabId>("preview");
  const [appearanceTab, setAppearanceTab] = useState<"theme" | "colors" | "layout">("theme");
  const [printTab, setPrintTab] = useState<"invoice" | "receipt" | "statement" | "ledger" | "common">("invoice");
  const [invoicePreviewScale, setInvoicePreviewScale] = useState(() =>
    readPreviewZoom(previewZoomStorageKeys.invoice, 0.76)
  );
  const [receiptPreviewScale, setReceiptPreviewScale] = useState(() =>
    readPreviewZoom(previewZoomStorageKeys.receipt, 0.8)
  );
  const [statementPreviewScale, setStatementPreviewScale] = useState(() =>
    readPreviewZoom(previewZoomStorageKeys.statement, 0.78)
  );
  const [customerLedgerPreviewScale, setCustomerLedgerPreviewScale] = useState(() =>
    readPreviewZoom(previewZoomStorageKeys.customerLedger, 0.78)
  );
  useEffect(() => {
    const handleDeveloperShortcut = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.code === "KeyD") {
        event.preventDefault();
        openDeveloperSettings();
      }
    };

    window.addEventListener("keydown", handleDeveloperShortcut);
    return () => window.removeEventListener("keydown", handleDeveloperShortcut);
  }, [setLocation]);
  const handleVersionClick = () => {
    const now = Date.now();
    const nextCount = now - developerVersionTapRef.current.lastTapAt <= 2000
      ? developerVersionTapRef.current.count + 1
      : 1;

    developerVersionTapRef.current = { count: nextCount, lastTapAt: now };

    if (nextCount >= 5) {
      developerVersionTapRef.current = { count: 0, lastTapAt: 0 };
      openDeveloperSettings();
    }
  };
  useEffect(() => {
    writePreviewZoom(previewZoomStorageKeys.invoice, invoicePreviewScale);
  }, [invoicePreviewScale]);
  useEffect(() => {
    writePreviewZoom(previewZoomStorageKeys.receipt, receiptPreviewScale);
  }, [receiptPreviewScale]);
  useEffect(() => {
    writePreviewZoom(previewZoomStorageKeys.statement, statementPreviewScale);
  }, [statementPreviewScale]);
  useEffect(() => {
    writePreviewZoom(previewZoomStorageKeys.customerLedger, customerLedgerPreviewScale);
  }, [customerLedgerPreviewScale]);
  const [backupPassword, setBackupPassword] = useState("");
  const [importPassword, setImportPassword] = useState("");
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

const deriveBackupKey = async (password: string, salt: Uint8Array<ArrayBuffer>) => {
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

      if (!res.ok) {
        alert(isAR ? "فشل استيراد الفواتير" : "Failed to import invoices");
        return;
      }
      alert(isAR ? "تم استيراد الفواتير بنجاح" : "Invoices imported successfully");
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

      const result = await res.json();
      const duplicates = Number(result.duplicates ?? 0);
      const drafted = Number(result.drafted ?? 0);
      if (Number(result.skipped ?? 0) > 0) {
        const details = (result.errors ?? []).slice(0, 5).map((entry: { receiptNumber: string; reason: string }) =>
          `${entry.receiptNumber}: ${entry.reason}`).join("\n");
        alert(isAR
          ? `استُوردت ${result.inserted ?? 0} سندات وحُدّثت ${result.updated ?? 0}؛ حُوّل ${drafted} إلى مسودة، وتجاوزنا ${duplicates} مكررًا، وتعذّر استيراد ${result.skipped}.\n${details}`
          : `${result.inserted ?? 0} receipts imported, ${result.updated ?? 0} updated, ${drafted} saved as drafts, ${duplicates} duplicates ignored, ${result.skipped} failed.\n${details}`);
        return;
      }
      alert(isAR ? `تم استيراد السندات؛ حُوّل ${drafted} إلى مسودة وتجاوزنا ${duplicates} مكررًا.` : `Receipts imported; ${drafted} saved as drafts, ${duplicates} duplicates ignored.`);
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
      alert(isAR ? "تم استيراد العملاء بنجاح" : "Clients imported successfully");
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
      alert(isAR ? "تم استيراد البنود بنجاح" : "Items imported successfully");
    };


  if (!["admin", "manager", "supervisor"].includes(user?.role || "") && !isDeveloperSupportMode) {
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
      outputType: "image/png",
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
          logoHeight: Number(rawPayload.logoHeight ?? 0),
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
            logoHeight: Number((settings as CompanySettings & { logoHeight?: number }).logoHeight ?? 0),
            stampBase64: settings.stampBase64 ?? null,
            watermarkBase64: settings.watermarkBase64 ?? null,
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

  const TABS: Array<{ id: TabId; icon: typeof Eye; labelAr: string; labelEn: string; color: string }> = [
  { id: "preview", icon: Eye, labelAr: "المعاينة", labelEn: "Preview", color: "text-indigo-500" },

  { id: "company", icon: Building2, labelAr: "بيانات الشركة", labelEn: "Company", color: "text-blue-500" },
  { id: "branding", icon: Image, labelAr: "الشعارات", labelEn: "Branding", color: "text-purple-500" },
  { id: "print", icon: Printer, labelAr: "أدوات الطباعة", labelEn: "Print Tools", color: "text-rose-500" },
  { id: "backup", icon: Shield, labelAr: "استيراد وتصدير البيانات", labelEn: "Data Import & Export", color: "text-emerald-500" },
  { id: "update", icon: RefreshCw, labelAr: "تحديث البرنامج", labelEn: "Software Update", color: "text-cyan-500" },

  { id: "devices", icon: Shield, labelAr: "الأجهزة الموثوقة", labelEn: "Trusted Devices", color: "text-teal-500" },
  { id: "display", icon: Palette, labelAr: "المظهر", labelEn: "Display", color: "text-fuchsia-500" }, // آخر واحد
];

  const canViewSettingsTab = (tabId: TabId) => {
    if (tabId === "devices") return user?.role === "admin";
    if (canViewAllSettingsTabs) return true;
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
  }, [activeTab, visibleTabIds]);

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
      dir="ltr"
      className="ledger-settings pb-10"
    >
      <style>{`
        .ledger-settings input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="file"]):not([type="color"]),
        .ledger-settings select { min-height: 40px; font-size: 14px; line-height: 20px; border-radius: 8px; }
        .ledger-settings textarea { font-size: 14px; line-height: 1.6; border-radius: 8px; }
        .ledger-settings .settings-control-content label { font-size: 14px; line-height: 20px; }
        .ledger-settings .settings-control-content button:not([role="switch"]) { font-size: 14px; }
      `}</style>
      <SettingsShell<TabId>
        dir={isRTL ? "rtl" : "ltr"}
        title={isAR ? "إعدادات البرنامج" : "Settings"}
        description={isAR ? "إدارة إعدادات الشركة والطباعة والنسخ الاحتياطي ومظهر التطبيق" : "Manage company, print, backup, and appearance settings"}
        tabs={visibleTabs.map((tab) => ({
          id: tab.id,
          icon: tab.icon,
          label: isAR ? tab.labelAr : tab.labelEn,
          color: tab.color,
        }))}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        actions={
          <>
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:opacity-60"
            >
              {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? (isAR ? "جارٍ الحفظ..." : "Saving...") : (isAR ? "حفظ التغييرات" : "Save Changes")}
            </button>
          </>
        }
      >
      {/* ── Content Area ───────────────────────────────────────── */}
      <div
        className={cn("min-w-0 w-full space-y-5", activeTab !== "preview" && "settings-control-content ms-0 me-auto max-w-[1120px]", isRTL ? "md:order-1" : "md:order-2")}
        dir={isRTL ? "rtl" : "ltr"}
      >

        {/* Section title */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">
              {activeTab === "preview" && (isAR ? "المعاينة" : "Preview")}
              {activeTab === "company" && (isAR ? "بيانات الشركة" : "Company")}
              {activeTab === "branding" && (isAR ? "الشعارات" : "Branding")}
              {activeTab === "print" && (isAR ? "أدوات الطباعة" : "Print Tools")}
              {activeTab === "backup" && (isAR ? "استيراد وتصدير البيانات" : "Data Import & Export")}
              {activeTab === "update" && (isAR ? "تحديث البرنامج" : "Software Update")}
              {activeTab === "display" && (isAR ? "المظهر" : "Display")}
              {activeTab === "devices" && (isAR ? "الأجهزة الموثوقة" : "Trusted Devices")}
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {activeTab === "preview" && (isAR ? "معاينة مباشرة لشكل المستندات قبل الطباعة" : "Live preview of documents before printing")}
              {activeTab === "company" && (isAR ? "إدارة بيانات الشركة الأساسية ومعلومات التواصل" : "Manage company identity and contact details")}
              {activeTab === "branding" && (isAR ? "إدارة الشعار والختم والعلامة المائية والتوقيعات" : "Manage logo, stamp, watermark, and signatures")}
              {activeTab === "print" && (isAR ? "ضبط عناوين الفواتير وأدوات الطباعة" : "Configure invoice titles and print tools")}
              {activeTab === "backup" && (isAR ? "تصدير واستيراد بيانات البرنامج بشكل آمن" : "Securely export and import application data")}
              {activeTab === "update" && (isAR ? "البحث عن تحديثات البرنامج وتثبيتها من داخل التطبيق" : "Check and install application updates from inside the app")}
              {activeTab === "display" && (isAR ? "ضبط ألوان ومظهر واجهة البرنامج" : "Customize application colors and appearance")}
              {activeTab === "devices" && (isAR ? "عرض هوية الجهاز وإدارة الأجهزة الموثوقة" : "Device identity and trusted devices")}
            </p>
          </div>
        </div>


          {activeTab === "devices" && user?.role === "admin" && (
            <DeviceIdentitySettings isAR={isAR} />
          )}

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
                  <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
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
                    <PreviewScaleControl
                      label={isAR ? "تكبير ملخص العميل المالي" : "Customer ledger zoom"}
                      value={customerLedgerPreviewScale}
                      min={0.55}
                      max={1.1}
                      onChange={setCustomerLedgerPreviewScale}
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
                  customerLedgerPreviewScale={customerLedgerPreviewScale}
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
                          <div className="text-center text-sm text-slate-500 border-t pt-2">
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
                            {form.showStampOnInvoices && currentStampSrc && (
                              <img
                                src={currentStampSrc}
                                alt="stamp"
                                className="h-12 mx-auto object-contain opacity-90"
                              />
                            )}
                            <div className="text-sm text-slate-500">
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

          {/* ── Export and import data Tab |التصدير والاستيراد ── */}
          {activeTab === "backup" && (
            <Section
              icon={Shield}
              title={isAR ? "إستيراد وتصدير البيانات" : "Export and import data"}
              color="bg-emerald-500/5"
            >
              <div className="space-y-4">
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
                  className="rounded-2xl border border-border bg-card p-4 shadow-sm"
                  dir={isAR ? "rtl" : "ltr"}
                >
                  {/* All Data Row "كل البيانات" */}
                  <div className="border border-border bg-background rounded-lg p-3 mb-3">
                    <div className="flex flex-wrap items-center justify-between gap-3 w-full">
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
                            className={`h-8 w-32 rounded-md border border-border bg-background px-2 text-xs text-foreground ${
                              isAR ? "pl-9" : "pr-9"
                            }`}
                          />

                          <button
                            type="button"
                            onClick={() => setShowBackupPassword(!showBackupPassword)}
                            className={`absolute top-1/2 -translate-y-1/2 ${
                              isAR ? "left-1" : "right-1"
                            } p-1 text-muted-foreground hover:text-foreground`}
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

                          // Fetch each section in the same order used when restoring the backup.
                          const sections = [
                            ["items", "/api/invoice-item-templates"],
                            ["clients", "/api/clients"],
                            ["invoices", "/api/invoices"],
                            ["receipts", "/api/receipts"],
                          ] as const;
                          const rawData: Record<(typeof sections)[number][0], unknown> & { receiptsUnavailable?: boolean } = {
                            items: [], clients: [], invoices: [], receipts: [],
                          };
                          for (const [key, endpoint] of sections) {
                            try {
                              const response = await fetch(`http://127.0.0.1:3000${endpoint}`, {
                                headers: { Authorization: `Bearer ${token}` },
                              });
                              if (!response.ok) throw new Error(`Export ${key}: HTTP ${response.status}`);
                              const rows = await response.json();
                              if (!Array.isArray(rows)) throw new Error(`Export ${key}: invalid data`);
                              rawData[key] = rows;
                            } catch (error) {
                              console.error(error);
                              if (key === "receipts") {
                                rawData.receipts = null;
                                rawData.receiptsUnavailable = true;
                                break;
                              }
                              alert(isAR ? "فشل تصدير البيانات الأساسية؛ لم يُحفظ ملف ناقص" : "Core backup export failed; no incomplete file was saved");
                              return;
                            }
                          }

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
                          if (rawData.receiptsUnavailable) {
                            alert(isAR ? "حُفظت البنود والعملاء والفواتير؛ تعذّر تصدير سندات القبض. احتفظ بنسخة منفصلة منها لاحقًا." : "Items, clients and invoices were saved; receipts could not be exported. Export them separately later.");
                          }
                        }}
                        className="h-8 px-3 text-xs bg-muted/30 border border-border text-foreground rounded-md hover:bg-muted/50 transition"
                      >
                        {isAR ? "تصدير" : "Export"}
                      </button>

                      <div className="relative">
                        <input
                          type={showImportPassword ? "text" : "password"}
                          value={importPassword}
                          onChange={(e) => setImportPassword(e.target.value)}
                          placeholder={isAR ? "كلمة مرور الاستيراد" : "Import password"}
                          className={`h-8 w-32 rounded-md border border-border bg-background px-2 text-xs text-foreground ${
                            isAR ? "pl-9" : "pr-9"
                          }`}
                        />

                        <button
                          type="button"
                          onClick={() => setShowImportPassword(!showImportPassword)}
                          className={`absolute top-1/2 -translate-y-1/2 ${
                            isAR ? "left-1" : "right-1"
                          } p-1 text-muted-foreground hover:text-foreground`}
                        >
                          {showImportPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => document.getElementById("full-import")?.click()}
                        className="h-8 px-3 text-xs bg-muted/30 border border-border text-foreground rounded-md hover:bg-muted/50 transition"
                      >
                        {isAR ? "استيراد" : "Import"}
                      </button>

                    </div>
                  </div>
                 </div>

                 <div
                  className="flex flex-wrap items-center justify-between gap-3 border border-border bg-card rounded-xl p-4 mt-4 w-full"
                  dir={isAR ? "rtl" : "ltr"}
                >
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold">{isAR ? "كلمة مرور الطوارئ (الماستر)" : "Master Emergency Password"}</h3>
                    <p className="text-xs text-muted-foreground">{isAR ? "اتركها فارغة للإبقاء على كلمة المرور الحالية، ثم اضغط حفظ التغييرات عند تعديلها." : "Leave empty to keep the current password. Click Save Changes after editing."}</p>
                  </div>

                  <div className="relative">
                    <input
                      type={showMasterPassword ? "text" : "password"}
                      value={form.masterPassword || ""}
                      onChange={(e) => setForm((f) => ({ ...f, masterPassword: e.target.value }))}
                      placeholder={isAR ? "اتركها فارغة لعدم التغيير" : "Leave empty to keep unchanged"}
                      className={`h-10 w-full sm:w-64 rounded-md border border-border bg-background text-sm text-foreground ${
                        isAR ? "pl-8 pr-2" : "pr-8 pl-2"
                      }`}
                    />

                    <button
                      type="button"
                      onClick={() => setShowMasterPassword((v) => !v)}
                      className={`absolute top-1/2 -translate-y-1/2 ${
                        isAR ? "left-2" : "right-2"
                      } text-muted-foreground hover:text-foreground`}
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

                      const sections = [
                        ["items", "/api/invoice-item-templates/import"],
                        ["clients", "/api/clients/import"],
                        ["invoices", "/api/invoices/import"],
                        ["receipts", "/api/receipts/import"],
                      ] as const;
                      const receiptsUnavailable = fullData.receiptsUnavailable === true && fullData.receipts === null;
                      for (const [key] of sections) {
                        if (key === "receipts" && receiptsUnavailable) continue;
                        if (!Array.isArray(fullData[key])) {
                          alert(isAR ? `النسخة الكاملة لا تحتوي بيانات صالحة: ${key}` : `Invalid full backup section: ${key}`);
                          return;
                        }
                      }
                      const token = sessionStorage.getItem("auth_token");
                      let clientIdMap: Record<string, number> | undefined;
                      let invoiceIdMap: Record<string, number> | undefined;
                      let skippedInvoices = 0;
                      let skippedReceipts = 0;
                      let duplicateReceipts = 0;
                      let draftedReceipts = 0;
                      let receiptErrors: Array<{ receiptNumber: string; reason: string }> = [];
                      for (const [key, endpoint] of sections) {
                        if (key === "receipts" && receiptsUnavailable) continue;
                        try {
                          const response = await fetch(`http://127.0.0.1:3000${endpoint}`, {
                            method: "POST",
                            headers: {
                              "Content-Type": "application/json",
                              Authorization: `Bearer ${token}`,
                            },
                            body: JSON.stringify({ data: fullData[key], clientIdMap, invoiceIdMap }),
                          });
                          if (!response.ok) throw new Error(`Import ${key}: HTTP ${response.status}`);
                          const result = await response.json();
                          if (key === "clients") clientIdMap = result.clientIdMap;
                          if (key === "invoices") {
                            invoiceIdMap = result.invoiceIdMap;
                            skippedInvoices = Number(result.skipped ?? 0);
                          }
                          if (key === "receipts") {
                            skippedReceipts = Number(result.skipped ?? 0);
                            duplicateReceipts = Number(result.duplicates ?? 0);
                            draftedReceipts = Number(result.drafted ?? 0);
                            receiptErrors = result.errors ?? [];
                          }
                        } catch (error) {
                          console.error(error);
                          if (key === "receipts") {
                            alert(isAR ? "استُوردت البنود والعملاء والفواتير؛ تعذّر استيراد سندات القبض. أعد استيرادها لاحقًا." : "Items, clients and invoices were imported; receipts failed. Import them separately later.");
                            return;
                          }
                          alert(isAR ? `توقف الاستيراد عند: ${key}. لم تُستورد المراحل التالية.` : `Import stopped at ${key}; later sections were not imported.`);
                          return;
                        }
                      }
                      if (receiptsUnavailable) {
                        alert(isAR ? "استُوردت البنود والعملاء والفواتير؛ لم تكن سندات القبض متاحة في ملف النسخة." : "Items, clients and invoices were imported; receipts were unavailable in this backup.");
                        return;
                      }
                      if (skippedInvoices || skippedReceipts) {
                        const details = receiptErrors.slice(0, 5).map((entry) =>
                          `${entry.receiptNumber}: ${entry.reason}`).join("\n");
                        alert(isAR
                          ? `اكتمل الاستيراد جزئيًا: تعذّر استيراد ${skippedInvoices} فاتورة و${skippedReceipts} سند قبض؛ حُوّل ${draftedReceipts} إلى مسودة وتجاوزنا ${duplicateReceipts} مكررًا.\n${details}`
                          : `Import partially completed: ${skippedInvoices} invoices and ${skippedReceipts} receipts failed; ${draftedReceipts} saved as drafts, ${duplicateReceipts} duplicates ignored.\n${details}`);
                        return;
                      }
                      alert(isAR
                        ? `تم الاستيراد؛ حُوّل ${draftedReceipts} سند قبض إلى مسودة وتجاوزنا ${duplicateReceipts} مكررًا.`
                        : `Import completed; ${draftedReceipts} receipts saved as drafts, ${duplicateReceipts} duplicates ignored.`);
                    }}
                  />
                  <input
                    id="invoices-import"
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;

                      await importInvoices(file);

                      e.target.value = "";
                    }}
                  />

                  <input
                    id="clients-import"
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;

                      await importClients(file);

                      e.target.value = "";
                    }}
                  />

                  <input
                    id="receipts-import"
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;

                      await importReceipts(file);

                      e.target.value = "";
                    }}
                  />

                  <input
                    id="items-import"
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;

                      await importItems(file);

                      e.target.value = "";
                    }}
                  />

                  <div className="grid grid-cols-1 gap-3 mt-4 xl:grid-cols-2">
                    {/* البنود */}
                    <div className="flex flex-wrap justify-between items-center gap-3 border border-border bg-background rounded-xl p-3">
                      <span className="text-sm">{isAR ? "البنود" : "Items"}</span>
                      <div className="flex gap-2">
                        <button type="button" onClick={exportItems} className="h-8 px-3 text-xs bg-muted/30 border border-border text-foreground rounded-md hover:bg-muted/50 transition">
                          {isAR ? "تصدير" : "Export"}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            document.getElementById("items-import")?.click();
                          }}
                          className="h-8 px-3 text-xs bg-muted/30 border border-border text-foreground rounded-md hover:bg-muted/50 transition"
                        >
                          {isAR ? "استيراد" : "Import"}
                        </button>

                      </div>
                    </div>
                    {/* العملاء */}
                    <div className="flex flex-wrap justify-between items-center gap-3 border border-border bg-background rounded-xl p-3">
                      <span className="text-sm">{isAR ? "العملاء" : "Clients"}</span>
                      <div className="flex gap-2">
                        <button type="button" onClick={exportClients} className="h-8 px-3 text-xs bg-muted/30 border border-border text-foreground rounded-md hover:bg-muted/50 transition">
                          {isAR ? "تصدير" : "Export"}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            document.getElementById("clients-import")?.click();
                          }}
                          className="h-8 px-3 text-xs bg-muted/30 border border-border text-foreground rounded-md hover:bg-muted/50 transition"
                        >
                          {isAR ? "استيراد" : "Import"}
                        </button>

                      </div>
                    </div>

                    {/* الفواتير */}
                    <div className="flex flex-wrap justify-between items-center gap-3 border border-border bg-background rounded-xl p-3">
                      <span className="text-sm">{isAR ? "الفواتير" : "Invoices"}</span>
                      <div className="flex gap-2">

                        <button type="button" onClick={exportInvoices} disabled={!canUseInvoicesBackupImport} className={cn("h-8 px-3 text-xs bg-muted/30 border border-border text-foreground rounded-md hover:bg-muted/50 transition", !canUseInvoicesBackupImport && "cursor-not-allowed opacity-50 hover:bg-muted/30")}>
                          {isAR ? "تصدير" : "Export"}
                        </button>

                        <button
                          type="button"
                          disabled={!canUseInvoicesBackupImport}
                          onClick={() => {
                            if (!canUseInvoicesBackupImport) return;
                            document.getElementById("invoices-import")?.click();
                          }}
                          className={cn(
                            "h-8 px-3 text-xs bg-muted/30 border border-border text-foreground rounded-md hover:bg-muted/50 transition",
                            !canUseInvoicesBackupImport && "cursor-not-allowed opacity-50 hover:bg-muted/30"
                          )}
                        >
                          {isAR ? "استيراد" : "Import"}
                        </button>

                      </div>
                    </div>

                    {/* سندات القبض */}
                    <div className="flex flex-wrap justify-between items-center gap-3 border border-border bg-background rounded-xl p-3">
                      <span className="text-sm">{isAR ? "سندات القبض" : "Receipts"}</span>
                      <div className="flex gap-2">
                        <button type="button" onClick={exportReceipts} className="h-8 px-3 text-xs bg-muted/30 border border-border text-foreground rounded-md hover:bg-muted/50 transition">
                          {isAR ? "تصدير" : "Export"}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            document.getElementById("receipts-import")?.click();
                          }}
                          className="h-8 px-3 text-xs bg-muted/30 border border-border text-foreground rounded-md hover:bg-muted/50 transition"
                        >
                          {isAR ? "استيراد" : "Import"}
                        </button>

                      </div>
                    </div>

                  </div>
                </div>
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

                <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div className="rounded-xl border border-border bg-background p-3">
                      <div className="text-xs font-semibold uppercase text-muted-foreground">
                        {isAR ? "الإصدار الحالي" : "Current Version"}
                      </div>
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={handleVersionClick}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            handleVersionClick();
                          }
                        }}
                        className="mt-1 font-mono text-sm font-bold text-foreground"
                      >
                        {import.meta.env.VITE_APP_VERSION || "v2.0.0"}
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
                      className="h-9 rounded-lg border border-border bg-muted/30 px-3 text-xs font-semibold text-foreground hover:bg-muted/50"
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
                      className="h-9 rounded-lg border border-border bg-muted/30 px-3 text-xs font-semibold text-foreground hover:bg-muted/50 disabled:opacity-50"
                    >
                      {isAR ? "تثبيت التحديث" : "Install Update"}
                    </button>

                    <button
                      type="button"
                      onClick={async () => {
                        const api = (window as any).electronAPI;

                        if (!api?.selectUpdateInstaller || !api?.runUpdateInstaller) {
                          setUpdateStatus(
                            isAR
                              ? "التحديث من ملف غير متاح داخل هذه النسخة."
                              : "Local installer updates are not available in this version."
                          );
                          return;
                        }

                        try {
                          const result = await api.selectUpdateInstaller();

                          if (result?.canceled) {
                            return;
                          }

                          if (!result?.ok) {
                            setUpdateStatus(
                              result?.error ||
                                (isAR
                                  ? "ملف التحديث غير صالح."
                                  : "The update installer is invalid.")
                            );
                            return;
                          }

                          const confirmed = window.confirm(
                            isAR
                              ? `سيتم تحديث Ledger من الإصدار ${result.currentVersion} إلى الإصدار ${result.installerVersion}.\n\nسيتم إغلاق البرنامج وتشغيل برنامج التثبيت تلقائيًا.\n\nهل تريد المتابعة؟`
                              : `Ledger will be updated from version ${result.currentVersion} to version ${result.installerVersion}.\n\nLedger will close and the installer will start automatically.\n\nDo you want to continue?`
                          );

                          if (!confirmed) {
                            return;
                          }

                          setUpdateStatus(
                            isAR
                              ? "جاري بدء التحديث..."
                              : "Starting update..."
                          );

                          const installResult = await api.runUpdateInstaller(result.path);

                          if (!installResult?.ok) {
                            setUpdateStatus(
                              installResult?.error ||
                                (isAR
                                  ? "فشل بدء التحديث."
                                  : "Failed to start the update.")
                            );
                          }
                        } catch (error: any) {
                          setUpdateStatus(
                            error?.message ||
                              (isAR
                                ? "فشل بدء التحديث."
                                : "Failed to start the update.")
                          );
                        }
                      }}
                      className="h-9 rounded-lg border border-border bg-muted/30 px-3 text-xs font-semibold text-foreground hover:bg-muted/50"
                    >
                      {isAR ? "اختيار ملف تحديث" : "Choose Update File"}
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
            <Section icon={Icon} title={title} color={color}>{children}</Section>
          );

          return (
            <>
            <div className="space-y-5">
              <div role="tablist" aria-label={isAR ? "أقسام المظهر" : "Appearance sections"} className="flex flex-wrap gap-2 border-b border-border pb-4">
                {[
                  { id: "theme" as const, ar: "مظهر الواجهة والخلفية", en: "Theme & Background", icon: Sun },
                  { id: "colors" as const, ar: "الألوان", en: "Colors", icon: Palette },
                  { id: "layout" as const, ar: "النصوص وخيارات العرض", en: "Text & Layout", icon: SlidersHorizontal },
                ].map(tab => (
                  <button key={tab.id} id={`appearance-tab-${tab.id}`} type="button" role="tab" aria-selected={appearanceTab === tab.id} aria-controls={`appearance-panel-${tab.id}`} onClick={() => setAppearanceTab(tab.id)} className={cn("inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors", appearanceTab === tab.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground")}>
                    <tab.icon className="h-4 w-4" />{isAR ? tab.ar : tab.en}
                  </button>
                ))}
              </div>
              <div id="appearance-panel-theme" role="tabpanel" aria-labelledby="appearance-tab-theme" hidden={appearanceTab !== "theme"} className="space-y-6">
              <SectionCard icon={Sun} title={isAR ? "مظهر الواجهة" : "Interface Theme"} color="bg-yellow-500/5">
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
                      <label className="text-xs font-semibold text-muted-foreground  shrink-0">
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
                        <span className="text-xs font-semibold text-muted-foreground ">
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
                        <span className="text-sm text-muted-foreground">5%</span>
                        <span className="text-sm text-muted-foreground">80%</span>
                      </div>
                    </div>
                  </div>
                )}
              </SectionCard>
              </div>
              <div id="appearance-panel-colors" role="tabpanel" aria-labelledby="appearance-tab-colors" hidden={appearanceTab !== "colors"} className="space-y-6">
              <SectionCard icon={Palette} title={isAR ? "اللون الأساسي" : "Primary Color"} color="bg-fuchsia-500/5">
                <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-7 gap-2">
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
                    <span className="h-6 px-3 rounded-full text-xs font-bold flex items-center"
                      style={{
                        background: COLOR_PRESETS[display.primaryColor].hex,
                        color: `hsl(${COLOR_PRESETS[display.primaryColor].foreground ?? "210 40% 98%"})`,
                        border: `1px solid hsl(${COLOR_PRESETS[display.primaryColor].border ?? COLOR_PRESETS[display.primaryColor].light})`,
                      }}>
                      {isAR ? "زر أساسي" : "Primary Button"}
                    </span>
                    <span className="h-6 px-3 rounded-full text-xs font-bold flex items-center border-2"
                      style={{
                        borderColor: `hsl(${COLOR_PRESETS[display.primaryColor].border ?? COLOR_PRESETS[display.primaryColor].light})`,
                        color: `hsl(${COLOR_PRESETS[display.primaryColor].foreground ? "222 47% 11%" : COLOR_PRESETS[display.primaryColor].light})`,
                      }}>
                      {isAR ? "حد ملوّن" : "Outline"}
                    </span>
                  </div>
                </div>
              </SectionCard>
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
              </div>
              <div id="appearance-panel-layout" role="tabpanel" aria-labelledby="appearance-tab-layout" hidden={appearanceTab !== "layout"} className="space-y-6">
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
                      <span className="font-mono text-sm opacity-60">{hint}</span>
                    </button>
                  ))}
                </div>
              </SectionCard>
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
                <p className="text-xs font-semibold text-muted-foreground ">{isAR ? "شعار الشركة" : "Company Logo"}</p>
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
                                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">
                    {isAR ? "موضع الشعار (أعلى / أسفل)" : "Logo Position (Up / Down)"}
                  </label>
                  <input
                    type="number"
                    min="-50"
                    max="50"
                    value={form.logoHeight ?? 0}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, logoHeight: Number(e.target.value) }))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                  />
                </div>

              </div>}
              {/* Stamp */}
              {canEditStamp && <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground ">{isAR ? "ختم الشركة" : "Company Stamp"}</p>
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
                <p className="text-xs font-semibold text-muted-foreground ">
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
                <p className="text-xs font-semibold text-muted-foreground ">{isAR ? "العلامة المائية" : "Watermark"}</p>
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
            <Section icon={Printer} title={isAR ? "خيارات الطباعة" : "Print Options"} color="bg-rose-500/5" contentClassName="ledger-print-tools ms-0 me-auto max-w-[960px]">
              <style>{`
                .ledger-print-tools label { font-size: 14px; line-height: 20px; }
                .ledger-print-tools input:not([type="checkbox"]), .ledger-print-tools select { min-height: 40px; font-size: 14px; border-radius: 8px; }
                .ledger-print-tools input[type="number"] { width: 120px; max-width: 100%; }
                .ledger-print-tools textarea { font-size: 14px; line-height: 1.6; border-radius: 8px; }
              `}</style>
              <div className="space-y-4">

                <div role="tablist" aria-label={isAR ? "أقسام أدوات الطباعة" : "Print tools sections"} className="flex flex-wrap gap-2 border-b border-border pb-4">
                  {[
                    { id: "invoice" as const, ar: "الفواتير", en: "Invoices" },
                    { id: "receipt" as const, ar: "سندات القبض", en: "Receipts" },
                    { id: "statement" as const, ar: "كشف الحساب", en: "Statement" },
                    { id: "ledger" as const, ar: "ملخص العميل", en: "Customer Summary" },
                    { id: "common" as const, ar: "إعدادات مشتركة", en: "Shared Settings" },
                  ].map(tab => (
                    <button key={tab.id} id={`print-tab-${tab.id}`} type="button" role="tab" aria-selected={printTab === tab.id} aria-controls={`print-panel-${tab.id}`} onClick={() => setPrintTab(tab.id)} className={cn("rounded-lg border px-4 py-2 text-sm font-medium transition-colors", printTab === tab.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground")}>
                      {isAR ? tab.ar : tab.en}
                    </button>
                  ))}
                </div>
                {[
                  { field: "showStampOnInvoices" as const, labelAr: "إظهار الختم على الفواتير", labelEn: "Show stamp on invoices", icon: Stamp },
                  { field: "showStampOnReceipts" as const, labelAr: "إظهار الختم على سندات القبض", labelEn: "Show stamp on receipts", icon: Stamp },
                  { field: "showStampOnStatements" as const, labelAr: "إظهار الختم على كشوف الحساب", labelEn: "Show stamp on statements", icon: Stamp },
                ].filter(({ field }) =>
                  (printTab === "invoice" && field === "showStampOnInvoices") ||
                  (printTab === "receipt" && field === "showStampOnReceipts") ||
                  (printTab === "statement" && field === "showStampOnStatements")
                ).map(({ field, labelAr, labelEn, icon: Icon }) => (
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

                <div id="print-panel-invoice" role="tabpanel" aria-labelledby="print-tab-invoice" hidden={printTab !== "invoice"} className="space-y-5">
                  <DocumentTitleEditor prefix="invoice" titlePrefix="invoiceCredit" label={isAR ? "عنوان الفاتورة" : "Invoice title"} isAR={isAR} form={form} setForm={setForm} />
                  <details className="rounded-xl border border-border bg-background">
                    <summary className="cursor-pointer px-4 py-3 text-sm font-medium">{isAR ? "معاينة رأس الفاتورة" : "Invoice header preview"}</summary>
                    <div className="overflow-auto rounded-b-xl bg-white p-4 text-gray-900"><InvoicePrintHeader company={form} logoSrc={currentLogoSrc} isAR={isAR} invoiceNumber="INV-PREVIEW" statusText={isAR ? "مسودة" : "Draft"} /></div>
                  </details>
                </div>
                <div id="print-panel-receipt" role="tabpanel" aria-labelledby="print-tab-receipt" hidden={printTab !== "receipt"} className="space-y-5">
                  <DocumentTitleEditor prefix="receipt" titlePrefix="receipt" label={isAR ? "عنوان سند القبض" : "Receipt title"} isAR={isAR} form={form} setForm={setForm} />
                  <details className="rounded-xl border border-border bg-background">
                    <summary className="cursor-pointer px-4 py-3 text-sm font-medium">{isAR ? "معاينة رأس سند القبض" : "Receipt header preview"}</summary>
                    <div className="overflow-auto rounded-b-xl bg-white text-gray-900"><ReceiptPrintHeader receiptNumber="RCP-PREVIEW" override={{ settings: form, logoSrc: currentLogoSrc }} /></div>
                  </details>
                </div>
                <div id="print-panel-statement" role="tabpanel" aria-labelledby="print-tab-statement" hidden={printTab !== "statement"} className="space-y-5">
                  <DocumentTitleEditor prefix="statement" titlePrefix="statement" label={isAR ? "عنوان كشف الحساب" : "Statement title"} isAR={isAR} form={form} setForm={setForm} />
                </div>
                <div id="print-panel-ledger" role="tabpanel" aria-labelledby="print-tab-ledger" hidden={printTab !== "ledger"} className="space-y-5">
                  <DocumentTitleEditor prefix="customerLedger" titlePrefix="customerLedger" label={isAR ? "عنوان ملخص العميل المالي" : "Customer summary title"} isAR={isAR} form={form} setForm={setForm} />
                </div>
                <div id="print-panel-common" role="tabpanel" aria-labelledby="print-tab-common" hidden={printTab !== "common"} className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
                      <h3 className="text-base font-semibold">{isAR ? "العلامة المائية" : "Watermark"}</h3>
                      <div className="flex items-center justify-between gap-3"><span className="text-sm">{isAR ? "إظهارها في صفحات الطباعة" : "Show on print pages"}</span><Toggle field="showWatermark" /></div>
                      <p className="text-sm text-muted-foreground">{isAR ? "تؤثر في الفواتير وسندات القبض والكشوف. تُرفع الصورة من تبويب الشعارات." : "Applies to invoices, receipts and statements. Upload the image in Branding."}</p>
                    </div>
                    <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
                      <h3 className="text-base font-semibold">{isAR ? "التوقيعات" : "Signatures"}</h3>
                      {canEditAccountantSignature && <div className="flex items-center justify-between gap-3"><span className="text-sm">{isAR ? "إظهار توقيع المحاسب" : "Show accountant signature"}</span><Toggle field="showAccountantSignature" /></div>}
                      <div className="flex items-center justify-between gap-3"><span className="text-sm">{isAR ? "إظهار توقيع المستلم" : "Show receiver signature"}</span><Toggle field="showReceiverSignature" /></div>
                      <p className="text-sm text-muted-foreground">{isAR ? "تؤثر في المستندات التي تعرض التوقيعات، مع مراعاة خيار إظهار التوقيعات داخل معاينة الطباعة." : "Applies where signatures are supported, subject to the signature toggle in print preview."}</p>
                    </div>
                  </div>
                  <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-4">
                    <h3 className="text-base font-semibold">{isAR ? "تذييل المستندات" : "Document footer"}</h3>

                <Field
                  label={isAR ? "نص التذييل في صفحات الطباعة" : "Footer text on print pages"}
                  hint={isAR ? "نص مشترك يظهر في تذييل المستندات التي تستخدم إعدادات الطباعة" : "Shared text displayed in document print footers"}
                >
                  <textarea
                    value={form.footerText}
                    onChange={e => setForm(p => ({ ...p, footerText: e.target.value }))}
                    rows={3}
                    className={`${inp} resize-none`}
                    placeholder={isAR ? "مثال: شكراً لتعاملكم معنا · جميع الأسعار شاملة الضريبة" : "e.g. Thank you for your business"}
                  />
                </Field>
                    {form.footerText && <div className="rounded-lg border border-gray-200 bg-white p-4 text-center text-xs text-gray-500 whitespace-pre-line">{form.footerText}</div>}
                  </div>
                </div>
              </div>
            </Section>
          )}
          {/* Info banner */}
          {["company", "branding", "print"].includes(activeTab) && (
            <div className="flex items-start gap-3 p-4 bg-blue-500/5 border border-blue-500/20 rounded-2xl text-sm text-blue-700 dark:text-blue-300">
              <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <p>
                {isAR
                  ? "احفظ التغييرات لتطبيق إعدادات الشركة والشعارات والطباعة في البرنامج والمستندات."
                  : "Save changes to apply company, branding, and print settings to the application and documents."}
              </p>
            </div>
          )}

          </div>
        </SettingsShell>
        </motion.div>
      );
    }
