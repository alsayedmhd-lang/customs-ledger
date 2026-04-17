import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import { useGetClientStatement } from "@workspace/api-client-react";
import { formatCurrency, formatDate, formatNumber, arabicNums } from "@/lib/utils";
import { Printer, ArrowRight, ArrowLeft, Stamp } from "lucide-react";
import Barcode from "react-barcode";
import { useLanguage } from "@/lib/language-context";
import { useCompanySettings } from "@/lib/company-settings-context";

const STATUS_AR: Record<string, string> = {
  draft: "مسودة",
  issued: "صادرة",
  paid: "مدفوعة",
  cancelled: "ملغاة",
};

const STATUS_COLOR: Record<string, string> = {
  draft: "text-gray-500",
  issued: "text-blue-700 font-semibold",
  paid: "text-green-700 font-semibold",
  cancelled: "text-red-600 line-through",
};

export default function ClientStatement() {
  const { id } = useParams<{ id: string }>();
  const { data: statement, isLoading } = useGetClientStatement(parseInt(id || "0"));
  const { lang } = useLanguage();
  const isAR = lang === "ar";
  const { settings, logoSrc, stampSrc, watermarkSrc, currentUser } = useCompanySettings();
  const currencySymbol = lang === "en" ? "QAR" : "ر.ق";
  const user = statement?.user;
  const canCustomize = user?.permissions?.canCustomizePrintContact;
  const printPhone = canCustomize && user?.phone ? user.phone : settings.phone;
  const printEmail = canCustomize && user?.email ? user.email : settings.email;
  const [showStamp, setShowStamp] = useState<boolean>(() => {
    try { return localStorage.getItem("statement_show_stamp") !== "false"; }
    catch { return true; }
  });

  function toggleStamp(val: boolean) {
    setShowStamp(val);
    try { localStorage.setItem("statement_show_stamp", val ? "true" : "false"); } catch {}
  }

  useEffect(() => {
    if (!statement) return;
    const prev = document.title;
    document.title = `ST-${new Date().toLocaleDateString("en-CA")} - ${statement.client.name}`;
    return () => { document.title = prev; };
  }, [statement]);

  if (isLoading) return <div className="p-8 text-center">{isAR ? "جارٍ إنشاء كشف الحساب..." : "Loading statement..."}</div>;
  if (!statement) return <div className="p-8 text-center text-red-600">{isAR ? "كشف الحساب غير موجود" : "Statement not found"}</div>;

  const { client, invoices, totalDue, totalPaid, balance } = statement;
  const today = new Date().toISOString();
  const statementRef = `ST-${client.id}-${new Date().getFullYear()}`;

  // Running balance table
  let runningBalance = 0;
  const rows = invoices.map((inv) => {
    runningBalance += inv.total;
    return { ...inv, runningBalance };
  });

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white" dir="rtl">
      {/* Print CSS */}
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 10mm 10mm 10mm 15mm; }
          body { margin: 0; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>

      {/* Controls */}
      <div className="print:hidden flex items-center gap-3 p-6 max-w-4xl mx-auto flex-wrap" dir={isAR ? "rtl" : "ltr"}>
        <Link href={`/clients/${id}`}>
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-700 hover:bg-gray-50 font-medium">
            {isAR ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />} {isAR ? "العودة للعميل" : "Back to Client"}
          </button>
        </Link>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-5 py-2 bg-blue-700 text-white rounded-lg font-medium hover:bg-blue-800"
        >
          <Printer className="w-4 h-4" />
          {isAR ? "طباعة كشف الحساب" : "Print Statement"}
        </button>
        {settings.showStampOnStatements && (
          <label className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg bg-white cursor-pointer select-none hover:bg-gray-50">
            <input
              type="checkbox"
              checked={showStamp}
              onChange={e => toggleStamp(e.target.checked)}
              className="w-4 h-4 accent-blue-700"
            />
            <Stamp className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">{isAR ? "إظهار الختم" : "Show Stamp"}</span>
          </label>
        )}
      </div>

      {/* ── A4 Statement Document ────────────────────────────────────────────── */}
      <div
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
              <div className="text-3xl font-black text-blue-800 mt-2">{settings.nameEn.split(" ").slice(0, 3).join(" ")}</div>
              <div className="text-2xl font-bold text-blue-800">{settings.subtitleEn}</div>
            </div>
          </div>
        )}

        {/* ══ LETTERHEAD ══════════════════════════════════════════════════ */}
        <div className="border-b-4 border-double border-gray-800 pb-3 pt-4 px-6" style={{ position: "relative", zIndex: 1 }}>
          <div className="flex items-start justify-between">
            {/* Right: Arabic */}
            <div className="text-right">
              <div className="text-2xl font-black text-gray-900 leading-tight">{settings.nameAr.split(" ").slice(0, 2).join(" ")}</div>
              <div className="text-lg font-bold text-gray-700">{settings.subtitleAr}</div>
              <div className="text-xs text-gray-500 mt-1">{settings.nameEn}</div>
              <div className="text-xs text-gray-500">{settings.taglineAr}</div>
            </div>
            {/* Center: Logo */}
            <div className="flex flex-col items-center justify-center">
              <img src={logoSrc} alt={settings.nameAr} className="h-24 w-auto object-contain" />
            </div>
            {/* Left: English */}
            <div className="text-left">
              <div className="text-2xl font-black text-gray-900 leading-tight">{settings.nameEn.split(" ").slice(0, 3).join(" ").toUpperCase()}</div>
              <div className="text-lg font-bold text-gray-700">{settings.subtitleEn}</div>
              <div className="text-xs text-gray-500 mt-1">{printEmail}</div>
              <div className="text-xs text-gray-500">Tel: {printPhone} · {settings.poBox} {settings.address}</div>
            </div>
          </div>
        </div>

        {/* ══ STATEMENT TITLE / META ═══════════════════════════════════════ */}
        <div className="border-b border-gray-400 px-6 py-2 bg-gray-50" style={{ position: "relative", zIndex: 1 }}>
          <div className="flex items-center justify-between text-sm">
            <div className="font-bold text-gray-800">
              Ref : <span className="font-mono text-blue-800">{statementRef}</span>
            </div>
            <div className="text-center font-bold text-gray-800 text-lg">
              كشف حساب
              <span className="mx-2 text-gray-400 text-sm">|</span>
              <span className="text-sm font-normal text-gray-600">ACCOUNT STATEMENT</span>
            </div>
            <div className="font-bold text-gray-800 text-left">
              Date : <span className="font-mono">{new Date().toLocaleDateString("en-CA")}</span>
            </div>
          </div>
          <div className="flex justify-center py-1">
            <Barcode
              value={statementRef}
              format="CODE128"
              width={1.4}
              height={40}
              fontSize={11}
              margin={0}
              displayValue={true}
            />
          </div>
        </div>

        {/* ══ CLIENT INFO + SUMMARY ════════════════════════════════════════ */}
        <div className="px-6 py-3 border-b border-gray-300" style={{ position: "relative", zIndex: 1 }}>
          <div className="grid grid-cols-2 gap-6">
            {/* Client details */}
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">بيانات العميل / Client Details</p>
              <p className="text-base font-black text-gray-900">{client.name}</p>
              {client.address && <p className="text-sm text-gray-600 mt-0.5">{client.address}</p>}
              {client.taxId && <p className="text-sm text-gray-600">الرقم الضريبي: {client.taxId}</p>}
              {client.email && <p className="text-sm text-gray-500">{client.email}</p>}
              {client.phone && <p className="text-sm text-gray-500">☎ {client.phone}</p>}
            </div>

            {/* Summary box */}
            <div className="border-2 border-gray-700 rounded text-sm">
              <div className="bg-gray-800 text-white text-center py-1 font-bold text-xs uppercase tracking-widest">
                ملخص الحساب / Account Summary
              </div>
              <div className="divide-y divide-gray-200">
                <div className="flex justify-between px-4 py-1.5">
                  <span className="text-gray-600">إجمالي الفواتير / Total Invoiced</span>
                  <span className="font-mono font-bold text-gray-800">{formatCurrency(totalDue)}</span>
                </div>
                <div className="flex justify-between px-4 py-1.5">
                  <span className="text-gray-600">إجمالي المدفوع / Total Paid</span>
                  <span className="font-mono font-bold text-green-700">{formatCurrency(totalPaid)}</span>
                </div>
                <div className="flex justify-between px-4 py-2 bg-gray-50">
                  <span className="font-black text-gray-900">الرصيد المستحق / Balance Due</span>
                  <span className={`font-mono font-black text-base ${balance > 0 ? "text-red-700" : "text-green-700"}`}>
                    {formatCurrency(balance)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ══ TRANSACTIONS TABLE ══════════════════════════════════════════ */}
        <div className="px-6 pt-4" style={{ position: "relative", zIndex: 1 }}>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-y-2 border-gray-700 bg-gray-100">
                <th className="text-right py-2 px-2 font-bold text-gray-700 w-10">#</th>
                <th className="text-right py-2 px-3 font-bold text-gray-700">رقم الفاتورة / Invoice No</th>
                <th className="text-right py-2 px-3 font-bold text-gray-700">التاريخ / Date</th>
                <th className="text-center py-2 px-2 font-bold text-gray-700">الحالة / Status</th>
                <th className="text-right py-2 px-3 font-bold text-gray-700">ملاحظات / Notes</th>
                <th className="text-left py-2 px-2 font-bold text-gray-700 w-24">مدين / Debit</th>
                <th className="text-left py-2 px-2 font-bold text-gray-700 w-24 text-green-700">دفعة مقدمة / Advance</th>
                <th className="text-left py-2 px-2 font-bold text-gray-700 w-24">الرصيد / Balance</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-gray-500 border-b border-dashed border-gray-300">
                    لا توجد فواتير مسجلة.
                  </td>
                </tr>
              ) : (
                rows.map((inv, idx) => (
                  <tr key={inv.id} className="border-b border-dashed border-gray-300 hover:bg-gray-50">
                    <td className="py-2 px-2 text-gray-500 text-center font-mono text-xs">
                      {arabicNums(String(idx + 1).padStart(3, "0"))}
                    </td>
                    <td className="py-2 px-3 font-semibold text-blue-800">{inv.invoiceNumber}</td>
                    <td className="py-2 px-3 text-gray-600">{formatDate(inv.issueDate)}</td>
                    <td className="py-2 px-2 text-center">
                      <span className={`text-xs ${STATUS_COLOR[inv.status] || ""}`}>
                        {STATUS_AR[inv.status] || inv.status}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-gray-600 text-xs max-w-[140px]">
                      <span className="line-clamp-2 leading-snug">
                        {(inv as any).notes || <span className="text-gray-300">—</span>}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-left font-mono font-bold text-gray-800">
                      {formatNumber(((inv as any).subtotal ?? 0) + ((inv as any).taxAmount ?? 0) || inv.total, 2)}
                    </td>
                    <td className="py-2 px-2 text-left font-mono font-bold text-green-700">
                      {(inv as any).advancePayment > 0
                        ? formatNumber((inv as any).advancePayment, 2)
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="py-2 px-2 text-left font-mono text-gray-700">
                      {formatNumber(inv.runningBalance, 2)}
                    </td>
                  </tr>
                ))
              )}
              {/* Filler rows */}
              {rows.length < 8 &&
                Array.from({ length: Math.max(0, 8 - rows.length) }).map((_, i) => (
                  <tr key={`empty-${i}`} className="border-b border-dashed border-gray-200">
                    <td className="py-3 px-2" />
                    <td className="py-3 px-3" />
                    <td className="py-3 px-3" />
                    <td className="py-3 px-2" />
                    <td className="py-3 px-3" />
                    <td className="py-3 px-2" />
                    <td className="py-3 px-2" />
                    <td className="py-3 px-2" />
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* ══ TOTALS + STAMP OVERLAY ══════════════════════════════════════ */}
        <div className="relative px-6 pb-3" style={{ zIndex: 1 }}>
          <div className="border-t-2 border-gray-700 pt-2 space-y-1">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-700">إجمالي الفواتير / Total Invoiced</span>
              <span className="font-mono font-bold text-gray-800">{formatNumber(totalDue, 2)} {currencySymbol}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-700">إجمالي المدفوع / Total Paid</span>
              <span className="font-mono font-bold text-green-700">{formatNumber(totalPaid, 2)} {currencySymbol}</span>
            </div>
            <div className="flex justify-between items-center border-t-2 border-double border-gray-700 pt-2 mt-1">
              <span className="font-black text-base text-gray-800">الرصيد المستحق / Balance Due</span>
              <span className={`font-black font-mono text-base ${balance > 0 ? "text-red-700" : "text-green-700"}`}>
                {formatNumber(balance, 2)} {currencySymbol}
              </span>
            </div>
          </div>
          {/* Notice */}
          <div className="border border-gray-300 bg-gray-50 rounded px-3 py-2 mt-3 text-xs text-gray-600 text-center">
            يُرجى سداد المبالغ المستحقة في أقرب وقت ممكن — Please settle outstanding balances promptly.
          </div>

          {/* Stamp — absolute overlay, does not affect layout */}
          {settings.showStampOnStatements && showStamp && (
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
        <div className="border-t-4 border-double border-gray-700 px-6 py-3 bg-gray-50" style={{ position: "relative", zIndex: 1 }}>
          <div className="flex items-center justify-between text-xs text-gray-600">
            <span>✉ {printEmail}</span>
            <span className="font-bold text-gray-800">{settings.nameAr} · {settings.nameEn.split(" ").slice(0, 3).join(" ")} C.C</span>
            <span>{settings.poBox} {settings.address} · ☎ {printPhone}</span>
          </div>
          {settings.footerText && (
            <div className="text-center text-xs text-gray-500 mt-1">{settings.footerText}</div>
          )}
          <div className="text-center text-xs text-gray-400 mt-1">
            طُبعت في: {new Date().toLocaleDateString("ar-EG-u-nu-latn", { year: "numeric", month: "long", day: "numeric" })}
            {" — "}المرجع: {statementRef}
            {" — "}عدد الفواتير: {arabicNums(invoices.length)}
          </div>
        </div>
      </div>
    </div>
  );
}
