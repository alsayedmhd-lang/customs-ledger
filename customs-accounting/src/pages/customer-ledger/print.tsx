import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, FileDown, Printer, Stamp } from "lucide-react";
import Barcode from "react-barcode";
import { PrintDocumentFooter, StatementPrintHeader } from "@/components/print-document-parts";

import { useAuth } from "@/lib/auth-context";
import { savePdf } from "@/lib/pdf";
import { useCompanySettings } from "@/lib/company-settings-context";
import { useLanguage } from "@/lib/language-context";

const API_BASE = import.meta.env.VITE_API_BASE_URL;

function getToken() {
  return sessionStorage.getItem("auth_token");
}

function formatDateYMD(value: Date | string | null | undefined = new Date()) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (!value) return new Date().toISOString().slice(0, 10);

  const normalized = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(normalized)) return normalized.slice(0, 10);

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? normalized : parsed.toISOString().slice(0, 10);
}

async function fetchCustomerLedger(clientId: string, from?: string | null, to?: string | null) {
  const res = await fetch(
    `${API_BASE}/api/customer-ledger/${clientId}?from=${from || ""}&to=${to || ""}`,
    {
      headers: {
        Authorization: `Bearer ${getToken()}`,
      },
    }
  );

  if (!res.ok) {
    throw new Error(`Failed to load customer ledger: ${res.status}`);
  }

  return res.json();
}

async function fetchClients() {
  const res = await fetch(`${API_BASE}/api/clients`, {
    headers: {
      Authorization: `Bearer ${getToken()}`,
    },
  });

  if (!res.ok) {
    return [];
  }

  return res.json();
}

export default function CustomerLedgerPrintPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { lang } = useLanguage();
  const isAR = lang === "ar";

  const { settings, logoSrc, stampSrc, watermarkSrc } = useCompanySettings();

  const params = new URLSearchParams(window.location.search);
  const clientId = params.get("clientId");
  const from = params.get("from");
  const to = params.get("to");

  const [showStamp, setShowStamp] = useState(true);

  useEffect(() => {
    if (!user?.permissions?.canViewStatements) {
      navigate("/");
    }
  }, [user, navigate]);

  const { data, isLoading } = useQuery({
    queryKey: ["customer-ledger-print", clientId, from, to],
    queryFn: () => fetchCustomerLedger(clientId || "", from, to),
    enabled: !!clientId && !!user?.permissions?.canViewStatements,
  });

  const { data: clients = [] } = useQuery<any[]>({
    queryKey: ["customer-ledger-print-clients"],
    queryFn: fetchClients,
    enabled: !!clientId && !!user?.permissions?.canViewStatements,
  });

  if (!user?.permissions?.canViewStatements) return null;
  if (!clientId) return <div className="p-8">Missing clientId</div>;
  if (isLoading) return <div className="p-8 text-center">Loading...</div>;

  const rows = data?.rows || [];
  const openingBalance = Number(data?.openingBalance || 0);

  const client =
    data?.client ||
    clients.find((c: any) => String(c.id) === String(clientId)) ||
    {};

  const clientFromList = clients.find((c: any) => String(c.id) === String(clientId));

    const clientName =
    clientFromList?.nameAr ||
    clientFromList?.nameEn ||
    clientFromList?.name ||
    data?.client?.nameAr ||
    data?.client?.nameEn ||
    data?.clientName ||
    "-";

  const clientAddress = client.address || client.city || "";

  const statementRef = `CL-${clientId}-${new Date().getFullYear()}`;
  const today = formatDateYMD();
  const fromDateText = formatDateYMD(from);
  const toDateText = formatDateYMD(to);

  const totalDebit = rows.reduce((sum: number, row: any) => sum + Number(row.debit || 0), 0);
  const totalCredit = rows.reduce((sum: number, row: any) => sum + Number(row.credit || 0), 0);
  const finalBalance = openingBalance + totalDebit - totalCredit;

  const formatMoney = (value: number) =>
    Number(value || 0).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const exportExcel = () => {
    let running = openingBalance;

    const headers = isAR
      ? ["التاريخ", "البيان", "المرجع", "مدين", "دائن", "الرصيد"]
      : ["Date", "Description", "Reference", "Debit", "Credit", "Balance"];

    const csvRows = rows.map((r: any) => {
      running += Number(r.debit || 0) - Number(r.credit || 0);

      return [
        r.entryDate,
        isAR ? r.descriptionAr || r.descriptionEn || "" : r.descriptionEn || r.descriptionAr || "",
        r.referenceNumber || "",
        Number(r.debit || 0).toFixed(2),
        Number(r.credit || 0).toFixed(2),
        running.toFixed(2),
      ];
    });

    const csvContent = [headers, ...csvRows]
      .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const fileName = isAR
    ? `كشف-ملخص-الحساب-${clientName}-${fromDateText}-${toDateText}.csv`
    : `Customer-Ledger-${clientName}-${fromDateText}-${toDateText}.csv`;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  let runningBalance = openingBalance;

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white" dir="rtl">
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          body { margin: 0; background: white !important; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>

      {/* CONTROLS */}
      <div className="print:hidden flex items-center justify-center gap-3 p-6 flex-wrap" dir={isAR ? "rtl" : "ltr"}>
        <Link href="/customer-ledger">
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-700 hover:bg-gray-50 font-medium">
            <ArrowRight className="w-4 h-4" />
            {isAR ? "العودة للكشوف" : "Back to Client"}
          </button>
        </Link>

        <button
        onClick={async () => {
            const fileName = isAR
            ? `كشف-ملخص-الحساب-${clientName}-${fromDateText}-${toDateText}`
            : `Customer-Ledger-${clientName}-${fromDateText}-${toDateText}`;

            await savePdf(fileName);
        }}
        className="flex items-center gap-2 px-5 py-2 bg-blue-700 text-white rounded-lg font-medium hover:bg-blue-800"
        >
        <Printer className="w-4 h-4" />
        {isAR ? "طباعة PDF" : "Print Account Summary"}
        </button>

        <button
            onClick={exportExcel}
            disabled={!rows.length}
            className="flex items-center gap-2 px-5 py-2 border border-green-600 rounded-lg bg-white text-green-700 hover:bg-green-50 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
            <FileDown className="w-4 h-4" />
            {isAR ? "تصدير Excel" : "Export Excel"}
            </button>

        {settings.showStampOnStatements && (
          <label className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg bg-white cursor-pointer select-none hover:bg-gray-50">
            <input
              type="checkbox"
              checked={showStamp}
              onChange={(e) => setShowStamp(e.target.checked)}
              className="w-4 h-4 accent-blue-700"
            />
            <Stamp className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">
              {isAR ? "إظهار الختم" : "Show Stamp"}
            </span>
          </label>
        )}
      </div>

      {/* A4 DOCUMENT */}
      <div
        className="max-w-4xl mx-auto print:max-w-none print:w-full print:mx-0 bg-white shadow-xl print:shadow-none border border-gray-200 print:border-none relative overflow-hidden"
        style={{ fontFamily: "'Cairo', 'Arial', sans-serif" }}
      >
        {/* WATERMARK */}
        {settings.showWatermark && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none"
            style={{ opacity: 0.06, zIndex: 0 }}
            aria-hidden="true"
          >
            <img src={watermarkSrc} alt="" className="w-72 object-contain mb-3" />
            <div className="text-center leading-tight text-blue-800">
              <div className="text-5xl font-black">{settings.nameAr}</div>
              <div className="text-3xl font-black mt-2">{settings.nameEn}</div>
              <div className="text-2xl font-bold">{settings.subtitleEn}</div>
            </div>
          </div>
        )}

        {/* LETTERHEAD */}
        <StatementPrintHeader statementRef={statementRef} dateText={today} />
        <div className="hidden">
          <div className="flex items-start justify-between flex-row-reverse">
            <div className="text-left" dir="ltr">
              <div className="text-2xl font-black text-gray-900 leading-tight uppercase">
                {settings.nameEn}
              </div>
              <div className="text-lg font-bold text-gray-700">{settings.subtitleEn}</div>
              <div className="text-xs text-gray-500 mt-1">{settings.email}</div>
              <div className="text-xs text-gray-500">
                Tel: {settings.phone} · {settings.poBox} {settings.address}
              </div>
            </div>

            <div className="flex flex-col items-center justify-center">
              <img src={logoSrc} alt={settings.nameAr} className="h-24 w-auto object-contain" />
            </div>

            <div className="text-right">
              <div className="text-2xl font-black text-gray-900 leading-tight">{settings.nameAr}</div>
              <div className="text-lg font-bold text-gray-700">{settings.subtitleAr}</div>
              <div className="text-xs text-gray-500 mt-1">{settings.nameEn}</div>
              <div className="text-xs text-gray-500">{settings.taglineAr}</div>
            </div>
          </div>
        </div>

        {/* TITLE / META */}
        <div className="hidden">
          <div className="flex items-center justify-between text-sm">
            <div className="font-bold text-gray-800" dir="ltr">
              Date : <span className="font-mono">{today}</span>
            </div>

            <div className="text-center font-bold text-gray-800 text-lg">
              كشف ملخص الحساب
              <span className="mx-2 text-gray-400 text-sm">|</span>
              <span className="text-sm font-normal text-gray-600">ACCOUNT SUMMARY</span>
            </div>

            <div className="font-bold text-gray-800 text-left" dir="ltr">
              Ref : <span className="font-mono text-blue-800">{statementRef}</span>
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

        {/* CLIENT INFO + SUMMARY */}
        <div className="px-6 py-3 border-b border-gray-300 relative z-10">
        <div className="grid grid-cols-2 gap-6">

            {/* بيانات العميل (يمين) */}
            <div className="text-right">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                بيانات العميل / CLIENT DETAILS
            </p>

            <p className="text-base font-black text-gray-900">
                {clientName}
            </p>

            {clientAddress && (
                <p className="text-sm text-gray-600 mt-0.5">
                {clientAddress}
                </p>
            )}

            <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-center">
                    <div className="font-bold text-gray-600">
                    من تاريخ / From Date
                    </div>
                    <div className="mt-1 font-mono text-gray-900">
                    {fromDateText}
                    </div>
                </div>

                <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-center">
                    <div className="font-bold text-gray-600">
                    إلى تاريخ / To Date
                    </div>
                    <div className="mt-1 font-mono text-gray-900">
                    {toDateText}
                    </div>
                </div>
                </div>
            </div>

            {/* ملخص الحساب (يسار) */}
            <div className="border-2 border-gray-700 rounded text-sm">
            <div className="bg-gray-800 text-white text-center py-1 font-bold text-xs uppercase tracking-widest">
                ملخص الحساب / ACCOUNT SUMMARY
            </div>

            <div className="divide-y divide-gray-200">

                <div className="flex justify-between px-4 py-1.5">
                <span className="text-gray-600">
                    إجمالي المدين / Total Debit
                </span>
                <span className="font-mono font-bold text-gray-800">
                    QR {formatMoney(totalDebit)}
                </span>
                </div>

                <div className="flex justify-between px-4 py-1.5">
                <span className="text-gray-600">
                    إجمالي الدائن / Total Credit
                </span>
                <span className="font-mono font-bold text-green-700">
                    QR {formatMoney(totalCredit)}
                </span>
                </div>

                <div className="flex justify-between px-4 py-2 bg-gray-50">
                <span className="font-black text-gray-900">
                    الرصيد / Balance
                </span>
                <span className={`font-mono font-black text-base ${finalBalance > 0 ? "text-red-700" : "text-green-700"}`}>
                    QR {formatMoney(finalBalance)}
                </span>
                </div>

            </div>
            </div>

        </div>
        </div>

        {/* TRANSACTIONS TABLE */}
        <div className="px-6 pt-4 relative z-10">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-y-2 border-gray-700 bg-gray-100">
                <th className="text-right py-2 px-2 font-bold text-gray-700 w-10">#</th>
                <th className="text-right py-2 px-3 font-bold text-gray-700">التاريخ / Date</th>
                <th className="text-right py-2 px-3 font-bold text-gray-700">البيان / Description</th>
                <th className="text-center py-2 px-2 font-bold text-gray-700">المرجع / Ref</th>
                <th className="text-left py-2 px-2 font-bold text-gray-700 w-24">مدين / Debit</th>
                <th className="text-left py-2 px-2 font-bold text-green-700 w-24">دائن / Credit</th>
                <th className="text-left py-2 px-2 font-bold text-gray-700 w-24">الرصيد / Balance</th>
              </tr>
            </thead>

            <tbody>
              <tr className="border-b border-dashed border-gray-300 bg-gray-50">
                <td className="py-2 px-2 text-gray-500 text-center font-mono text-xs">000</td>
                <td className="py-2 px-3 text-gray-600">—</td>
                <td className="py-2 px-3 font-semibold text-gray-800">رصيد سابق / Opening Balance</td>
                <td className="py-2 px-2 text-center">—</td>
                <td className="py-2 px-2 text-left font-mono">0.00</td>
                <td className="py-2 px-2 text-left font-mono text-green-700">0.00</td>
                <td className="py-2 px-2 text-left font-mono font-bold">
                  {formatMoney(openingBalance)}
                </td>
              </tr>

              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-500 border-b border-dashed border-gray-300">
                    لا توجد حركات مسجلة.
                  </td>
                </tr>
              ) : (
                rows.map((row: any, idx: number) => {
                  runningBalance += Number(row.debit || 0) - Number(row.credit || 0);

                  return (
                    <tr key={row.id || idx} className="border-b border-dashed border-gray-300 hover:bg-gray-50">
                      <td className="py-2 px-2 text-gray-500 text-center font-mono text-xs">
                        {String(idx + 1).padStart(3, "0")}
                      </td>

                      <td className="py-2 px-3 text-gray-600">
                        {formatDateYMD(row.entryDate)}
                      </td>

                      <td className="py-2 px-3 font-semibold text-gray-800">
                        {isAR ? row.descriptionAr || row.descriptionEn : row.descriptionEn || row.descriptionAr}
                      </td>

                      <td className="py-2 px-2 text-center text-blue-800 font-semibold">
                        {row.referenceNumber || "—"}
                      </td>

                      <td className="py-2 px-2 text-left font-mono font-bold text-gray-800">
                        {formatMoney(Number(row.debit || 0))}
                      </td>

                      <td className="py-2 px-2 text-left font-mono font-bold text-green-700">
                        {Number(row.credit || 0) > 0 ? formatMoney(Number(row.credit || 0)) : <span className="text-gray-300">—</span>}
                      </td>

                      <td className="py-2 px-2 text-left font-mono text-gray-700">
                        {formatMoney(runningBalance)}
                      </td>
                    </tr>
                  );
                })
              )}

              {rows.length < 8 &&
                Array.from({ length: Math.max(0, 8 - rows.length) }).map((_, i) => (
                  <tr key={`empty-${i}`} className="border-b border-dashed border-gray-200">
                    <td className="py-3 px-2" />
                    <td className="py-3 px-3" />
                    <td className="py-3 px-3" />
                    <td className="py-3 px-2" />
                    <td className="py-3 px-2" />
                    <td className="py-3 px-2" />
                    <td className="py-3 px-2" />
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* TOTALS */}
        <div className="relative px-6 pb-3 pt-4 z-10">
          <div className="border-t-2 border-gray-700 pt-2 space-y-1">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-700">إجمالي المدين / Total Debit</span>
              <span className="font-mono font-bold text-gray-800">QR {formatMoney(totalDebit)}</span>
            </div>

            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-700">إجمالي الدائن / Total Credit</span>
              <span className="font-mono font-bold text-green-700">QR {formatMoney(totalCredit)}</span>
            </div>

            <div className="flex justify-between items-center border-t-2 border-double border-gray-700 pt-2 mt-1">
              <span className="font-black text-base text-gray-800">الرصيد / Balance</span>
              <span className={`font-black font-mono text-base ${finalBalance > 0 ? "text-red-700" : "text-green-700"}`}>
                QR {formatMoney(finalBalance)}
              </span>
            </div>
          </div>

          <div className="border border-gray-300 bg-gray-50 rounded px-3 py-2 mt-3 text-xs text-gray-600 text-center">
            يُرجى مراجعة الحركات والرصيد — Please review the transactions and balance.
          </div>

          {settings.showStampOnStatements && showStamp && (
            <div
              className="absolute inset-0 flex items-end justify-center pointer-events-none"
              style={{ zIndex: 2, paddingBottom: 30 }}
            >
              <img
                src={stampSrc}
                alt="stamp"
                className="w-auto object-contain"
                style={{ height: 125, maxWidth: 210, opacity: 0.92 }}
              />
            </div>
          )}
        </div>

        {/* FOOTER */}
        <PrintDocumentFooter kind="statement" reference={statementRef} count={rows.length} />
        <div className="hidden">
          <div className="flex items-center justify-between text-xs text-gray-600">
            <span>✉ {settings.email}</span>

            <span className="font-bold text-gray-800">
              {settings.nameAr} · {settings.nameEn}
            </span>

            <span>
              {settings.poBox} {settings.address} · ☎ {settings.phone}
            </span>
          </div>

          {settings.footerText && (
            <div className="text-center text-xs text-gray-500 mt-1">
              {settings.footerText}
            </div>
          )}

          <div className="text-center text-xs text-gray-400 mt-1">
            طُبعت في: {today}
            {" — "}المرجع: {statementRef}
            {" — "}عدد الحركات: {rows.length}
          </div>
        </div>
      </div>
    </div>
  );
}
