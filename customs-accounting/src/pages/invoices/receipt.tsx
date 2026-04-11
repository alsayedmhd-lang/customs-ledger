import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import { useGetInvoice } from "@workspace/api-client-react";
import { Printer, ArrowRight, ArrowLeft, Stamp, Calculator } from "lucide-react";
import Barcode from "react-barcode";
import { arabicNums, formatNumber } from "@/lib/utils";
import { useLanguage } from "@/lib/language-context";
import { useCompanySettings } from "@/lib/company-settings-context";
import { useAuth } from "@/lib/auth-context";

// ── Number to English words ───────────────────────────────────────────────────
const engOnes = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];
const engTens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function threeDigitsEn(n: number): string {
  if (n === 0) return "";

  const h = Math.floor(n / 100);
  const r = n % 100;
  const t = Math.floor(r / 10);
  const o = r % 10;
  const parts: string[] = [];

  if (h > 0) parts.push(engOnes[h] + " Hundred");
  if (r < 20 && r > 0) {
    parts.push(engOnes[r]);
  } else {
    if (t > 0) parts.push(engTens[t]);
    if (o > 0) parts.push(engOnes[o]);
  }

  return parts.join(" ");
}

function numberToEnglishWords(amount: number): string {
  const total = Math.round(amount);
  if (total === 0) return "Zero Qatari Riyals Only";

  const billions = Math.floor(total / 1_000_000_000);
  const millions = Math.floor((total % 1_000_000_000) / 1_000_000);
  const thousands = Math.floor((total % 1_000_000) / 1_000);
  const remainder = total % 1_000;

  const parts: string[] = [];
  if (billions > 0) parts.push(threeDigitsEn(billions) + " Billion");
  if (millions > 0) parts.push(threeDigitsEn(millions) + " Million");
  if (thousands > 0) parts.push(threeDigitsEn(thousands) + " Thousand");
  if (remainder > 0) parts.push(threeDigitsEn(remainder));

  return parts.join(" ") + " Qatari Riyals Only";
}

// ── Number to Arabic words ────────────────────────────────────────────────────
const ones = [
  "",
  "واحد",
  "اثنان",
  "ثلاثة",
  "أربعة",
  "خمسة",
  "ستة",
  "سبعة",
  "ثمانية",
  "تسعة",
  "عشرة",
  "أحد عشر",
  "اثنا عشر",
  "ثلاثة عشر",
  "أربعة عشر",
  "خمسة عشر",
  "ستة عشر",
  "سبعة عشر",
  "ثمانية عشر",
  "تسعة عشر",
];
const tens = ["", "", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
const hundreds = ["", "مئة", "مئتان", "ثلاثمئة", "أربعمئة", "خمسمئة", "ستمئة", "سبعمئة", "ثمانمئة", "تسعمئة"];

function threeDigits(n: number): string {
  if (n === 0) return "";

  const h = Math.floor(n / 100);
  const r = n % 100;
  const t = Math.floor(r / 10);
  const o = r % 10;
  const parts: string[] = [];

  if (h > 0) parts.push(hundreds[h]);
  if (r < 20 && r > 0) {
    parts.push(ones[r]);
  } else {
    if (t > 0) parts.push(tens[t]);
    if (o > 0) parts.push(ones[o]);
  }

  return parts.join(" و");
}

function numberToArabicWords(amount: number): string {
  const total = Math.round(amount);
  if (total === 0) return "صفر ريال قطري فقط";

  const billions = Math.floor(total / 1_000_000_000);
  const millions = Math.floor((total % 1_000_000_000) / 1_000_000);
  const thousands = Math.floor((total % 1_000_000) / 1_000);
  const remainder = total % 1_000;

  const parts: string[] = [];

  if (billions === 1) parts.push("مليار");
  else if (billions === 2) parts.push("ملياران");
  else if (billions > 2) parts.push(threeDigits(billions) + " مليارات");

  if (millions === 1) parts.push("مليون");
  else if (millions === 2) parts.push("مليونان");
  else if (millions > 2) parts.push(threeDigits(millions) + " ملايين");

  if (thousands === 1) parts.push("ألف");
  else if (thousands === 2) parts.push("ألفان");
  else if (thousands > 2 && thousands < 11) parts.push(threeDigits(thousands) + " آلاف");
  else if (thousands >= 11) parts.push(threeDigits(thousands) + " ألف");

  if (remainder > 0) parts.push(threeDigits(remainder));

  return "ريال قطري " + parts.join(" و") + " فقط لا غير";
}

const STATUS_AR: Record<string, string> = {
  draft: "مسودة",
  issued: "فاتورة نقداً على الحساب",
  paid: "مدفوعة",
  cancelled: "ملغاة",
};

export default function InvoiceReceipt() {
  const { id } = useParams<{ id: string }>();
  const { data: invoice, isLoading } = useGetInvoice(parseInt(id || "0"));
  const { currencySymbol, lang } = useLanguage();
  const isAR = lang === "ar";
  const { settings, logoSrc, stampSrc, watermarkSrc } = useCompanySettings();
  const { user } = useAuth();

  const canCustomize = user?.permissions?.canCustomizePrintContact;
  const printPhone = canCustomize && user?.phone ? user.phone : settings.phone;
  const printEmail = canCustomize && user?.email ? user.email : settings.email;

  const [showStamp, setShowStamp] = useState<boolean>(() => {
    try {
      return localStorage.getItem("invoice_show_stamp") !== "false";
    } catch {
      return true;
    }
  });

  function toggleStamp(val: boolean) {
    setShowStamp(val);
    try {
      localStorage.setItem("invoice_show_stamp", val ? "true" : "false");
    } catch {}
  }

  useEffect(() => {
    if (!invoice) return;
    const prev = document.title;
    document.title = `${invoice.invoiceNumber} - ${invoice.clientName}`;
    return () => {
      document.title = prev;
    };
  }, [invoice]);

  if (isLoading) {
    return <div className="p-8 text-center">{isAR ? "جارٍ تحميل الفاتورة..." : "Loading invoice..."}</div>;
  }

  if (!invoice) {
    return <div className="p-8 text-center text-red-600">{isAR ? "الفاتورة غير موجودة" : "Invoice not found"}</div>;
  }

  const invNum = invoice.invoiceNumber;
  const amountWords = numberToArabicWords(invoice.total);
  const amountWordsEn = numberToEnglishWords(invoice.total);

const salesManName =
  (invoice as any).salesMan ||
  (user as any)?.englishName ||
  (user as any)?.nameEn ||
  (user as any)?.fullNameEn ||
  (user as any)?.fullName ||
  (user as any)?.name ||
  "-";

const impExpValue = (invoice as any).impExp || "—";

const importerExporterName =
  (invoice as any).importerExporterName || "—";

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white" dir="rtl">
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 10mm 10mm 10mm 15mm; }
          body { margin: 0; }
        }
      `}</style>

      {/* Controls - hidden on print */}
      <div className="print:hidden flex items-center gap-3 p-6 max-w-4xl mx-auto flex-wrap" dir={isAR ? "rtl" : "ltr"}>
        <Link href={`/invoices/${invoice.id}/edit`}>
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-700 hover:bg-gray-50 font-medium">
            {isAR ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
            {isAR ? "العودة للتعديل" : "Back to Edit"}
          </button>
        </Link>

        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-5 py-2 bg-blue-700 text-white rounded-lg font-medium hover:bg-blue-800"
        >
          <Printer className="w-4 h-4" />
          {isAR ? "طباعة الفاتورة" : "Print Invoice"}
        </button>

        <Link href={`/accounting?invoice=${encodeURIComponent(invoice.invoiceNumber)}`}>
          <button className="flex items-center gap-2 px-4 py-2 border border-emerald-400 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-medium">
            <Calculator className="w-4 h-4" />
            {isAR ? "حساب الفاتورة" : "Calculate Invoice"}
          </button>
        </Link>

        {settings.showStampOnInvoices && (
          <label className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg bg-white cursor-pointer select-none hover:bg-gray-50">
            <input
              type="checkbox"
              checked={showStamp}
              onChange={(e) => toggleStamp(e.target.checked)}
              className="w-4 h-4 accent-blue-700"
            />
            <Stamp className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">{isAR ? "إظهار الختم" : "Show Stamp"}</span>
          </label>
        )}
      </div>

      {/* ── A4 Invoice ────────────────────────────────────────────────────── */}
      <div
        id="invoice-print"
        className="max-w-4xl mx-auto print:max-w-none print:w-full print:mx-0 bg-white shadow-xl print:shadow-none border border-gray-200 print:border-none relative overflow-hidden"
        style={{ fontFamily: "'Cairo', 'Arial', sans-serif" }}
      >
        {/* ══ WATERMARK ═══════════════════════════════════════════════════ */}
        {settings.showWatermark && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none"
            style={{ opacity: 0.07, zIndex: 0 }}
            aria-hidden="true"
          >
            <img src={watermarkSrc} alt="" className="w-72 object-contain mb-4" />
            <div className="text-center leading-tight">
              <div className="text-5xl font-black text-blue-800" style={{ fontFamily: "'Cairo', sans-serif" }}>
                {settings.nameAr}
              </div>
              <div className="text-3xl font-black text-blue-800 mt-2" style={{ fontFamily: "'Arial', sans-serif" }}>
                {settings.nameEn.split(" ").slice(0, 3).join(" ")}
              </div>
              <div className="text-2xl font-bold text-blue-800" style={{ fontFamily: "'Arial', sans-serif" }}>
                {settings.subtitleEn}
              </div>
            </div>
          </div>
        )}

        {/* ══ LETTERHEAD / شعار ══════════════════════════════════════════ */}
        <div className="border-b-4 border-double border-gray-800 pb-3 pt-4 px-6">
          <div className="flex items-start justify-between">
            <div className="text-right">
              <div className="text-2xl font-black text-gray-900 leading-tight">
                {settings.nameAr.split(" ").slice(0, 2).join(" ")}
              </div>
              <div className="text-lg font-bold text-gray-700">{settings.subtitleAr}</div>
              <div className="text-xs text-gray-500 mt-1">{settings.nameEn}</div>
              <div className="text-xs text-gray-500">{settings.taglineAr}</div>
            </div>

            <div className="flex flex-col items-center justify-center">
              <img src={logoSrc} alt={settings.nameAr} className="h-24 w-auto object-contain" />
            </div>

            <div className="text-left">
              <div className="text-2xl font-black text-gray-900 leading-tight">
                {settings.nameEn.split(" ").slice(0, 3).join(" ").toUpperCase()}
              </div>
              <div className="text-lg font-bold text-gray-700">{settings.subtitleEn}</div>
              <div className="text-xs text-gray-500 mt-1">{printEmail}</div>
              <div className="text-xs text-gray-500">
                Tel: {printPhone} · {settings.poBox} {settings.address}
              </div>
            </div>
          </div>
        </div>

        {/* ══ INVOICE META ════════════════════════════════════════════════ */}
        <div className="flex items-stretch border-b-2 border-gray-700 bg-gray-50" dir="ltr">
          <div className="flex flex-col justify-center px-6 py-2.5" style={{ width: "40%", borderRight: "1px solid #d1d5db" }}>
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Invoice No</div>
            <div className="font-mono font-black text-blue-800 text-xl leading-none">{invNum}</div>
            <div className="mt-1.5">
              <Barcode value={invNum} format="CODE128" width={1.2} height={28} fontSize={0} margin={0} displayValue={false} />
              <div className="text-center text-[9px] font-mono text-gray-500">{invNum}</div>
            </div>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center px-6 py-2.5">
            <div className="text-[30px] font-black text-gray-900 leading-tight" dir="rtl">
              فاتورة نقداً على الحساب
            </div>
            <div className="mt-1 flex items-center gap-2.5 text-sm text-gray-500 font-semibold">
              <span>INVOICE CASH / CREDIT</span>
              <span className="w-1 h-1 rounded-full bg-gray-400 inline-block" />
              <span dir="rtl">{STATUS_AR[invoice.status] ?? invoice.status}</span>
            </div>
          </div>
        </div>

        {/* ══ INFO GRID ═══════════════════════════════════════════════════ */}
        <div className="border-b-2 border-gray-700" dir="ltr">
          {([
            [
              { label: "Customer / العميل", value: invoice.clientName, mono: false },
              { label: "Inv. Date", value: invoice.issueDate, mono: true },
            ],
            [
              { label: "Sales Man / المندوب", value: salesManName, mono: false },
              { label: "B.L / M AWB", value: invoice.billOfLading ?? "—", mono: true },
            ],
            [
              { label: "منفذ الدخول / Port", value: invoice.portOfEntry ?? "—", mono: false },
              {
                label: "Wight / الوزن",
                value: invoice.shipmentWeight != null ? `${invoice.shipmentWeight} Kg` : "—",
                mono: true,
              },
            ],
            [
              {
                label: "PeC No / عدد الطرود",
                value: invoice.packageCount != null ? `${invoice.packageCount} Pec` : "—",
                mono: false,
              },
              { label: "BAIAN No / رقم البيان", value: invoice.shipmentRef ?? "—", mono: true },
            ],
          ] as { label: string; value: string; mono: boolean }[][]).map((row, ri) => (
            <div key={ri} className="grid grid-cols-2 border-b border-dashed border-gray-200 last:border-b-0">
              {row.map((cell, ci) => (
                <div key={ci} className={`px-5 py-1.5 ${ci === 0 ? "border-r border-dashed border-gray-200" : ""}`}>
                  <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0 leading-tight">
                    {cell.label}
                  </div>
                  <div className={`text-[13px] leading-tight font-bold text-gray-900 ${cell.mono ? "font-mono" : ""}`}>
                    {cell.value}
                  </div>
                </div>
              ))}
            </div>
          ))}

          {/* Row 5: IMP/EXP + importer/exporter name + barcode */}
          <div className="grid grid-cols-2">
            <div className="px-5 py-1.5 border-r border-dashed border-gray-200">
              <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0 leading-tight">
                IMP / EXP
              </div>
              <div className="text-[13px] leading-tight font-bold text-gray-900">
                {impExpValue}
              </div>
              
              <div className="text-[13px] leading-tight font-bold text-gray-900 mt-1">
                {importerExporterName}
              </div>

              {invoice.dueDate && (
                <div className="text-[9px] text-gray-400 mt-0.5 leading-tight">
                  Due Date : <span className="font-mono text-gray-600">{invoice.dueDate}</span>
                </div>
              )}
            </div>

            <div className="px-5 py-1 flex items-center">
              {invoice.shipmentRef && (
                <Barcode
                  value={invoice.shipmentRef}
                  format="CODE128"
                  width={1.1}
                  height={26}
                  fontSize={8}
                  margin={0}
                  displayValue={true}
                />
              )}
            </div>
          </div>
        </div>

        {/* ══ ITEMS TABLE ═════════════════════════════════════════════════ */}
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
              {invoice.items.map((item, idx) => (
                <tr key={item.id} className="border-b border-dashed border-gray-300">
                  <td className="py-2 px-2 text-gray-500 text-center font-mono text-xs">
                    {arabicNums(String(idx + 1).padStart(4, "0"))}
                  </td>
                  <td className="py-2 px-3 text-gray-800">{item.description}</td>
                  <td className="py-2 px-2 text-center text-gray-700">{arabicNums(item.quantity)}</td>
                  <td className="py-2 px-2 text-center font-mono text-gray-700">
                    {formatNumber(item.unitPrice, 2)}
                  </td>
                  <td className="py-2 px-3 text-left font-mono font-bold text-gray-800">
                    {formatNumber(item.total, 2)}
                  </td>
                </tr>
              ))}

              {invoice.items.length < 5 &&
                Array.from({ length: 5 - invoice.items.length }).map((_, i) => (
                  <tr key={`empty-${i}`} className="border-b border-dashed border-gray-200">
                    <td className="py-3 px-2" />
                    <td className="py-3 px-3" />
                    <td className="py-3 px-2" />
                    <td className="py-3 px-2" />
                    <td className="py-3 px-3" />
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* ══ TOTALS ══════════════════════════════════════════════════════ */}
        <div className="px-6 pb-2">
          <div className="border-t-2 border-gray-700 pt-2 space-y-1">
            <TotalRow label="إجمالي الفاتورة / Invoice Amount" value={invoice.subtotal} />
            {invoice.taxRate > 0 && (
              <TotalRow label={`ضريبة / Tax (${arabicNums(invoice.taxRate)}%)`} value={invoice.taxAmount} />
            )}
            {(invoice as any).advancePayment > 0 && (
              <TotalRow label="الدفعة المقدمة / Advance Payment" value={(invoice as any).advancePayment} negative />
            )}

            <div className="flex justify-between items-center border-t-2 border-double border-gray-700 pt-2 mt-1">
              <span className="font-black text-base text-gray-800">الإجمالي الكلي / Grand Total</span>
              <span className="font-black font-mono text-base text-gray-900">
                {formatNumber(invoice.total, 2)} {currencySymbol}
              </span>
            </div>
          </div>

          <div className="border border-gray-300 bg-gray-50 rounded px-3 py-2 mt-3">
            <div className="text-sm text-right" dir="rtl">
              <span className="font-bold text-gray-600">المبلغ كتابةً : </span>
              <span className="font-bold text-gray-800">{amountWords}</span>
            </div>
            <div className="text-sm text-left border-t border-gray-200 mt-1.5 pt-1.5" dir="ltr">
              <span className="font-bold text-gray-600">Amount in Words: </span>
              <span className="font-bold text-gray-800">{amountWordsEn}</span>
            </div>
          </div>

          {invoice.notes && (
            <div className="mt-3 text-xs text-gray-500 border-t border-dashed border-gray-300 pt-2">
              <span className="font-bold">ملاحظات: </span>
              {invoice.notes}
            </div>
          )}
        </div>

        {/* ══ SIGNATURES / STAMP ══════════════════════════════════════════ */}
        <div className="relative grid grid-cols-2 gap-4 px-6 pb-4 pt-6 border-t border-gray-300 mt-4">
          <div className="text-center">
            <div className="h-16 border-b-2 border-gray-400" />
            <p className="text-xs text-gray-500 mt-1 font-bold">توقيع المستلم</p>
            <p className="text-xs text-gray-400">Received By</p>
          </div>

          <div className="text-center">
            <div className="h-16 border-b-2 border-gray-400" />
            <p className="text-xs text-gray-500 mt-1 font-bold">توقيع المحاسب</p>
            <p className="text-xs text-gray-400">Accountant</p>
          </div>

          {settings.showStampOnInvoices && showStamp && (
            <div
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
              style={{ zIndex: 2 }}
            >
              <img
                src={stampSrc}
                alt="الختم الرسمي"
                className="w-auto object-contain"
                style={{ height: "130px", maxWidth: "200px", opacity: 0.92 }}
              />
            </div>
          )}
        </div>

        {/* ══ FOOTER ══════════════════════════════════════════════════════ */}
        <div className="border-t-4 border-double border-gray-700 px-6 py-3 bg-gray-50">
          <div className="flex items-center justify-between text-xs text-gray-600">
            <span>✉ {printEmail}</span>
            <span className="font-bold text-gray-800">
              {settings.nameAr} · {settings.nameEn.split(" ").slice(0, 3).join(" ")} C.C
            </span>
            <span>
              {settings.poBox} {settings.address} · ☎ {printPhone}
            </span>
          </div>

          {settings.footerText && (
            <div className="text-center text-xs text-gray-500 mt-1">{settings.footerText}</div>
          )}

          <div className="text-center text-xs text-gray-400 mt-1">
            طُبعت في:{" "}
            {new Date().toLocaleDateString("ar-EG-u-nu-latn", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
            {" — "}رقم الفاتورة: {invNum}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Helper Components ─────────────────────────────────────────────────────────
function TotalRow({
  label,
  value,
  negative,
}: {
  label: string;
  value: number;
  negative?: boolean;
}) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-gray-700">{label}</span>
      <span className={`font-mono font-bold ${negative ? "text-green-700" : "text-gray-800"}`}>
        {negative ? "- " : ""}
        {formatNumber(value, 2)}
      </span>
    </div>
  );
}
