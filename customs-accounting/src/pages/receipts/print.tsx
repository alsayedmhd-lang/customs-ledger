import { useEffect, useState } from "react";
import { useParams, Link } from "wouter";
import { useGetReceipt, useListClients } from "@workspace/api-client-react";
import { Printer, ArrowRight, ArrowLeft, Stamp } from "lucide-react";
import Barcode from "react-barcode";
import { formatNumber, formatDate } from "@/lib/utils";
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
  if (r < 20 && r > 0) parts.push(engOnes[r]);
  else {
    if (t > 0) parts.push(engTens[t]);
    if (o > 0) parts.push(engOnes[o]);
  }

  return parts.join(" ");
}

function numberToEnglishWords(amount: number): string {
  const total = Math.round(amount);
  if (total === 0) return "Zero Qatari Riyals Only";

  const parts: string[] = [];
  const b = Math.floor(total / 1_000_000_000);
  const m = Math.floor((total % 1_000_000_000) / 1_000_000);
  const k = Math.floor((total % 1_000_000) / 1_000);
  const r = total % 1_000;

  if (b > 0) parts.push(threeDigitsEn(b) + " Billion");
  if (m > 0) parts.push(threeDigitsEn(m) + " Million");
  if (k > 0) parts.push(threeDigitsEn(k) + " Thousand");
  if (r > 0) parts.push(threeDigitsEn(r));

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
  if (r < 20 && r > 0) parts.push(ones[r]);
  else {
    if (t > 0) parts.push(tens[t]);
    if (o > 0) parts.push(ones[o]);
  }

  return parts.join(" و");
}

function numberToArabicWords(amount: number): string {
  const total = Math.round(amount);
  if (total === 0) return "صفر ريال قطري فقط";

  const b = Math.floor(total / 1_000_000_000);
  const m = Math.floor((total % 1_000_000_000) / 1_000_000);
  const k = Math.floor((total % 1_000_000) / 1_000);
  const r = total % 1_000;
  const parts: string[] = [];

  if (b === 1) parts.push("مليار");
  else if (b === 2) parts.push("ملياران");
  else if (b > 2) parts.push(threeDigits(b) + " مليارات");

  if (m === 1) parts.push("مليون");
  else if (m === 2) parts.push("مليونان");
  else if (m > 2) parts.push(threeDigits(m) + " ملايين");

  if (k === 1) parts.push("ألف");
  else if (k === 2) parts.push("ألفان");
  else if (k > 2 && k < 11) parts.push(threeDigits(k) + " آلاف");
  else if (k >= 11) parts.push(threeDigits(k) + " ألف");

  if (r > 0) parts.push(threeDigits(r));

  return "ريال قطري " + parts.join(" و") + " فقط لا غير";
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "نقداً / Cash",
  transfer: "تحويل بنكي / Bank Transfer",
  check: "شيك / Cheque",
};

export default function ReceiptPrint() {
  const { id } = useParams<{ id: string }>();
  const { data: receipt, isLoading } = useGetReceipt(parseInt(id || "0"));
  const { data: clients } = useListClients();
  const { currencySymbol, lang } = useLanguage();
  const isAR = lang === "ar";
  const { settings, logoSrc, stampSrc, watermarkSrc } = useCompanySettings();
  const { user } = useAuth();

  const canCustomize = user?.permissions?.canCustomizePrintContact;
  const printPhone = canCustomize && user?.phone ? user.phone : settings.phone;
  const printEmail = canCustomize && user?.email ? user.email : settings.email;

  const [showStamp, setShowStamp] = useState<boolean>(() => {
    try {
      return localStorage.getItem("receipt_show_stamp") !== "false";
    } catch {
      return true;
    }
  });

  function toggleStamp(val: boolean) {
    setShowStamp(val);
    try {
      localStorage.setItem("receipt_show_stamp", val ? "true" : "false");
    } catch {}
  }

  const getClientName = (r: { clientName?: string | null; clientId?: number | null }) => {
    if (r.clientName && r.clientName.trim()) return r.clientName;

    const client = (clients ?? []).find((c) => Number(c.id) === Number(r.clientId));
    return client?.name || "لا يوجد";
  };

  useEffect(() => {
    if (!receipt) return;
    const prev = document.title;
    document.title = `${receipt.receiptNumber} - ${getClientName(receipt)}`;
    return () => {
      document.title = prev;
    };
  }, [receipt, clients]);

  if (isLoading) {
    return <div className="p-8 text-center">{isAR ? "جارٍ تحميل السند..." : "Loading receipt..."}</div>;
  }

  if (!receipt) {
    return <div className="p-8 text-center text-red-600">{isAR ? "السند غير موجود" : "Receipt not found"}</div>;
  }

  const amountWords = numberToArabicWords(Number(receipt.amount));
  const amountWordsEn = numberToEnglishWords(Number(receipt.amount));
  const receiptNum = receipt.receiptNumber;

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white" dir="rtl">
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 10mm 10mm 10mm 15mm; }
          body { margin: 0; }
        }
      `}</style>

      <div className="print:hidden flex gap-3 p-4 max-w-2xl mx-auto flex-wrap" dir={isAR ? "rtl" : "ltr"}>
        <Link href="/receipts">
          <button className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-700 hover:bg-gray-50 text-sm font-medium">
            {isAR ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
            {isAR ? "العودة" : "Back"}
          </button>
        </Link>

        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-700 text-white rounded-lg text-sm font-medium hover:bg-blue-800"
        >
          <Printer className="w-4 h-4" />
          {isAR ? "طباعة السند" : "Print Receipt"}
        </button>

        {settings.showStampOnReceipts && (
          <label className="flex items-center gap-2 cursor-pointer px-3 py-2 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 select-none">
            <input
              type="checkbox"
              checked={showStamp}
              onChange={(e) => toggleStamp(e.target.checked)}
              className="accent-blue-700 w-4 h-4 cursor-pointer"
            />
            <Stamp className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">{isAR ? "إظهار الختم" : "Show Stamp"}</span>
          </label>
        )}
      </div>

      <div
        className="max-w-2xl mx-auto print:max-w-none print:w-full print:mx-0 bg-white shadow-lg print:shadow-none border border-gray-200 print:border-none relative overflow-hidden"
        style={{ fontFamily: "'Cairo', 'Arial', sans-serif" }}
      >
        {settings.showWatermark && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none"
            style={{ opacity: 0.06, zIndex: 0 }}
            aria-hidden="true"
          >
            <img src={watermarkSrc} alt="" className="w-44 object-contain mb-1" />
            <div className="text-center leading-tight">
              <div className="text-3xl font-black text-blue-800" style={{ fontFamily: "'Cairo', sans-serif" }}>
                {settings.nameAr}
              </div>
              <div className="text-xl font-black text-blue-800 mt-1">
                {settings.nameEn.split(" ").slice(0, 3).join(" ")}
              </div>
            </div>
          </div>
        )}

        <div className="border-b-4 border-double border-gray-800 pb-1 pt-1 px-5" style={{ position: "relative", zIndex: 1 }}>
          <div className="flex items-center justify-between">
            <div className="text-right">
              <div className="text-sm font-black text-gray-900 leading-tight">
                {settings.nameAr.split(" ").slice(0, 2).join(" ")}
              </div>
              <div className="text-xs font-bold text-gray-700">{settings.subtitleAr}</div>
              <div className="text-[10px] text-gray-500 mt-0.5">{settings.nameEn}</div>
              <div className="text-[10px] text-gray-500">{settings.taglineAr}</div>
            </div>

            <div className="flex flex-col items-center gap-0.5">
              <img src={logoSrc} alt={settings.nameAr} className="h-10 w-auto object-contain" />
              <div className="text-center">
                <div className="font-black text-gray-900 text-base leading-tight">سند قبض</div>
                <div className="text-gray-400 text-[10px] font-normal">RECEIPT VOUCHER</div>
              </div>
            </div>

            <div className="text-left">
              <div className="text-sm font-black text-gray-900 leading-tight">
                {settings.nameEn.split(" ").slice(0, 3).join(" ").toUpperCase()}
              </div>
              <div className="text-xs font-bold text-gray-700">{settings.subtitleEn}</div>
              <div className="text-[10px] text-gray-500 mt-0.5">{printEmail}</div>
              <div className="text-[10px] text-gray-500">
                Tel: {printPhone} · {settings.address}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mt-1 pt-1 border-t border-gray-200">
            <div className="text-right">
              <span className="text-xs font-bold text-gray-500">رقم السند / No: </span>
              <span className="font-mono text-blue-800 font-bold text-sm">{receiptNum}</span>
            </div>

            <Barcode
              value={receiptNum}
              format="CODE128"
              width={1.1}
              height={22}
              fontSize={7}
              margin={0}
              displayValue={false}
            />
          </div>
        </div>

        <div className="border-b border-gray-400 px-5 py-1.5" style={{ position: "relative", zIndex: 1 }}>
          <table className="w-full text-xs border-collapse border border-gray-300">
            <tbody>
              <tr className="border-b border-gray-200">
                <td className="px-3 py-1.5 font-bold text-gray-700 text-right bg-gray-50 w-32 border-l border-gray-200">
                  العميل
                </td>
                <td className="px-3 py-1.5 font-semibold text-gray-900 text-center border-l border-gray-200">
                  {getClientName(receipt)}
                </td>
                <td className="px-3 py-1.5 font-bold text-gray-400 text-left bg-gray-50 w-32 tracking-wide">
                  Customer
                </td>
              </tr>

              <tr className="border-b border-gray-200">
                <td className="px-3 py-1.5 font-bold text-gray-700 text-right bg-gray-50 border-l border-gray-200">
                  طريقة الدفع
                </td>
                <td className="px-3 py-1.5 font-semibold text-gray-900 text-center border-l border-gray-200">
                  {PAYMENT_METHOD_LABELS[receipt.paymentMethod] ?? receipt.paymentMethod}
                </td>
                <td className="px-3 py-1.5 font-bold text-gray-400 text-left bg-gray-50 tracking-wide">
                  Payment Method
                </td>
              </tr>

              <tr className="border-b border-gray-200">
                <td className="px-3 py-1.5 font-bold text-gray-700 text-right bg-gray-50 border-l border-gray-200">
                  رقم الفاتورة
                </td>
                <td className="px-3 py-1.5 font-semibold text-gray-900 text-center font-mono border-l border-gray-200">
                  {receipt.invoiceNumber ?? "—"}
                </td>
                <td className="px-3 py-1.5 font-bold text-gray-400 text-left bg-gray-50 tracking-wide">
                  Invoice No
                </td>
              </tr>

              <tr>
                <td className="px-3 py-1.5 font-bold text-gray-700 text-right bg-gray-50 border-l border-gray-200">
                  التاريخ
                </td>
                <td className="px-3 py-1.5 font-semibold text-gray-900 text-center border-l border-gray-200">
                  {formatDate(receipt.receiptDate)}
                </td>
                <td className="px-3 py-1.5 font-bold text-gray-400 text-left bg-gray-50 tracking-wide">
                  Date
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="px-5 py-1.5" style={{ position: "relative", zIndex: 1 }}>
          <table className="w-full text-sm border-collapse border border-gray-700">
            <thead>
              <tr className="border-b-2 border-gray-700 bg-gray-100">
                <th className="text-right py-1.5 px-3 font-bold text-gray-700">البيان / Description</th>
                <th className="text-left py-1.5 px-3 font-bold text-gray-700 w-36 border-r border-gray-700" dir="ltr">
                  {currencySymbol}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-dashed border-gray-300">
                <td className="py-2.5 px-3 text-right" dir="rtl">
                  <span className="font-medium text-gray-800">
                    {receipt.notes || `استلام مبلغ${receipt.invoiceNumber ? ` مقابل ${receipt.invoiceNumber}` : ""}`}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-left font-mono font-bold text-gray-800 border-r border-gray-300" dir="ltr">
                  {formatNumber(receipt.amount, 2)}
                </td>
              </tr>
            </tbody>
          </table>

          <div className="flex justify-between items-center border-t-2 border-double border-gray-700 pt-1.5 mt-0">
            <span className="font-black text-sm text-gray-800">Grand Total / الإجمالي الكلي</span>
            <span className="font-black font-mono text-lg text-gray-900">
              {formatNumber(receipt.amount, 2)} {currencySymbol}
            </span>
          </div>

          <div className="border border-gray-300 bg-gray-50 rounded px-3 py-1.5 mt-2">
            <div className="text-xs text-right font-bold leading-snug" dir="rtl">
              <span className="text-gray-500">المبلغ كتابةً: </span>
              <span className="text-gray-800">{amountWords}</span>
            </div>
            <div className="text-xs text-left font-bold leading-snug border-t border-gray-200 mt-1 pt-1" dir="ltr">
              <span className="text-gray-500">In Words: </span>
              <span className="text-gray-800">{amountWordsEn}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 px-10 pb-3 pt-4 border-t border-gray-300" style={{ position: "relative", zIndex: 3 }}>
          {settings.showStampOnReceipts && showStamp && (
            <div
              style={{
                position: "absolute",
                top: "42%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                zIndex: 4,
                pointerEvents: "none",
              }}
            >
              <img
                src={stampSrc}
                alt="الختم الرسمي"
                className="w-auto object-contain"
                style={{ height: "130px", maxWidth: "200px", opacity: 0.92 }}
              />
            </div>
          )}

          <div className="text-center">
            <div className="h-10 border-b-2 border-gray-400" />
            <p className="text-xs text-gray-500 mt-1 font-bold">توقيع المستلم</p>
            <p className="text-xs text-gray-400">Receiver Signature</p>
          </div>

          <div className="text-center">
            <div className="h-10 border-b-2 border-gray-400" />
            <p className="text-xs text-gray-500 mt-1 font-bold">توقيع المحاسب</p>
            <p className="text-xs text-gray-400">Accountant Signature</p>
          </div>
        </div>
      </div>
    </div>
  );
}
