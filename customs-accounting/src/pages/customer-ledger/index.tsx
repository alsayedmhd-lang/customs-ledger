import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";

type Client = {
  id: number;
  name?: string;
  nameAr?: string;
  nameEn?: string;
};

type LedgerRow = {
  id: string;
  entryDate: string;
  entryType: "invoice" | "receipt" | "advance" | string;
  descriptionAr?: string;
  descriptionEn?: string;
  referenceNumber?: string;
  debit?: number | string;
  credit?: number | string;
  balanceImpact?: number | string;
};

function formatMoney(value: number) {
  return Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDefaultDateRange() {
  const today = new Date();
  return {
    from: formatDateInput(new Date(today.getFullYear(), today.getMonth(), 1)),
    to: formatDateInput(today),
  };
}

export default function CustomerLedgerPage() {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const isAR = lang === "ar";
  const tr = (ar: string, en: string) => (isAR ? ar : en);
  const [data, setData] = useState<LedgerRow[]>([]);
  const [openingBalance, setOpeningBalance] = useState(0);
  const [clients, setClients] = useState<Client[]>([]);
  const [ledgerClient, setLedgerClient] = useState<Client | null>(null);
  const [selectedClientState, setSelectedClientState] = useState<Client | null>(null);
  const [clientId, setClientId] = useState<number | "">("");
  const [hasSelectedClient, setHasSelectedClient] = useState(false);
  const [fromDate, setFromDate] = useState(() => getDefaultDateRange().from);
  const [toDate, setToDate] = useState(() => getDefaultDateRange().to);
  const [referenceSearch, setReferenceSearch] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const [, navigate] = useLocation();
  const isClient = user?.role === "client";
  const effectiveClientId = clientId;

  const apiBase = (import.meta.env.VITE_API_BASE_URL || "http://localhost:10000").replace(/\/$/, "");
  const token = sessionStorage.getItem("auth_token");

  useEffect(() => {
    fetch(`${apiBase}/api/clients`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((res) => setClients(Array.isArray(res) ? res : []))
      .catch(console.error);
  }, [apiBase, token]);

  const handleClientSelected = useCallback((nextClientId: number | "") => {
    const nextClient =
      nextClientId
        ? clients.find((c) => Number(c.id) === Number(nextClientId)) ?? null
        : null;

    setClientId(nextClientId);
    setSelectedClientState(nextClient);
    setLedgerClient(nextClient);
    setHasSelectedClient(Boolean(nextClientId));
    setData([]);
    setOpeningBalance(0);
  }, [clients]);

  const selectedClient = useMemo(
    () => selectedClientState || ledgerClient || clients.find((c) => c.id === effectiveClientId),
    [clients, effectiveClientId, ledgerClient, selectedClientState]
  );
  const linkedClientId = Number(user?.clientId || clients[0]?.id || 0);
  const visibleClients = useMemo(
    () => isClient ? clients.filter((c) => Number(c.id) === linkedClientId) : clients,
    [clients, isClient, linkedClientId]
  );

  useEffect(() => {
    if (!isClient || linkedClientId <= 0) return;
    if (clientId !== linkedClientId || !hasSelectedClient) {
      handleClientSelected(linkedClientId);
    }
  }, [isClient, linkedClientId, clientId, hasSelectedClient, handleClientSelected]);

  const filteredData = useMemo(() => {
    const q = referenceSearch.trim().toLowerCase();
    if (!q) return data;
    return data.filter((row) =>
      String(row.referenceNumber || "").toLowerCase().includes(q) ||
      String(row.descriptionAr || "").toLowerCase().includes(q) ||
      String(row.descriptionEn || "").toLowerCase().includes(q)
    );
  }, [data, referenceSearch]);

  const totalDebit = useMemo(
    () => filteredData.reduce((sum, row) => sum + Number(row.debit || 0), 0),
    [filteredData]
  );

  const totalCredit = useMemo(
    () => filteredData.reduce((sum, row) => sum + Number(row.credit || 0), 0),
    [filteredData]
  );

  const finalBalance = useMemo(
    () => openingBalance + totalDebit - totalCredit,
    [openingBalance, totalDebit, totalCredit]
  );
  const isSearchDisabled = !hasSelectedClient || !effectiveClientId || isLoading;

  const loadLedger = async () => {
    if (!effectiveClientId) return;

    setIsLoading(true);

    try {
      const params = new URLSearchParams({
        from: fromDate,
        to: toDate,
        q: referenceSearch.trim(),
      });
      const requestUrl = `${apiBase}/api/customer-ledger/${effectiveClientId}?${params.toString()}`;

      const res = await fetch(requestUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();

      if (!res.ok) throw new Error(`Failed to load customer ledger: ${res.status}`);

      setData(Array.isArray(json) ? json : json.rows ?? []);
      setOpeningBalance(Number(json.openingBalance ?? 0));
      setLedgerClient(json.client ?? null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isClient || !hasSelectedClient || !effectiveClientId) return;
    loadLedger();
  }, [isClient, hasSelectedClient, effectiveClientId]);

  const openPrintPage = () => {
    if (!effectiveClientId) return;

    navigate(
      `/customer-ledger/print?clientId=${effectiveClientId}&from=${fromDate}&to=${toDate}&q=${encodeURIComponent(referenceSearch)}`
    );
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto" dir={isAR ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className={isAR ? "text-right" : "text-left"}>
          <h1 className="text-3xl font-bold text-gray-900">
            {tr("ملخص العميل المالي", "Customer Financial Summary")}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {tr("كشف مختصر لحركات العميل والرصيد", "A brief statement of customer transactions and balance")}
          </p>
        </div>

        <button
          type="button"
          onClick={openPrintPage}
          disabled={!effectiveClientId}
          className="px-5 py-2 rounded-xl bg-primary text-primary-foreground shadow hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {tr("الطباعة", "Print")}
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b bg-gray-50 flex items-center justify-between">
          <div>
            <div className="font-semibold text-gray-900">{tr("البحث والتصفية", "Search and filters")}</div>
            <div className="text-xs text-gray-500 mt-1">
              {tr("اختر العميل والفترة ثم اضغط بحث", "Select the client and period, then search")}
            </div>
          </div>

          <div className="text-sm text-gray-500">
            {data.length} {tr("حركة", "entries")}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-5 items-end">
          <div>
            <label className="text-sm font-medium text-gray-700">{tr("العميل", "Client")}</label>
            {isClient ? (
              <div className="w-full border rounded-xl px-3 py-2 mt-1 bg-gray-50 text-gray-900 min-h-[42px]">
                {selectedClient
                  ? selectedClient.nameAr || selectedClient.nameEn || selectedClient.name
                  : "â€”"}
              </div>
            ) : (
            <select
              className="w-full border rounded-xl px-3 py-2 mt-1 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              value={clientId}
              onChange={(e) => {
                handleClientSelected(e.target.value ? Number(e.target.value) : "");
              }}
            >
              {!isClient && <option value="">{tr("اختر العميل", "Select client")}</option>}
              {isClient && <option value="">{tr("اختر العميل", "Select client")}</option>}
              {visibleClients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nameAr || c.nameEn || c.name}
                </option>
              ))}
            </select>
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">
              {tr("من تاريخ", "From date")}
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full border rounded-xl px-3 py-2 mt-1 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">
              {tr("إلى تاريخ", "To date")}
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full border rounded-xl px-3 py-2 mt-1 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">
              {tr("رقم الفاتورة أو سند القبض", "Invoice or receipt number")}
            </label>
            <input
              value={referenceSearch}
              onChange={(e) => setReferenceSearch(e.target.value)}
              placeholder={tr("رقم الفاتورة أو سند القبض", "Invoice or receipt number")}
              className="w-full border rounded-xl px-3 py-2 mt-1 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <button
            type="button"
            onClick={loadLedger}
            disabled={isSearchDisabled}
            className="h-[42px] rounded-xl bg-primary text-primary-foreground shadow hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? tr("جاري البحث...", "Searching...") : tr("بحث", "Search")}
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border rounded-2xl p-4 shadow-sm">
          <div className="text-sm text-gray-500">{tr("العميل", "Client")}</div>
          <div className="font-bold text-gray-900 mt-1">
            {selectedClient
              ? selectedClient.nameAr || selectedClient.nameEn || selectedClient.name
              : "—"}
          </div>
        </div>

        <div className="bg-white border rounded-2xl p-4 shadow-sm">
          <div className="text-sm text-gray-500">{tr("إجمالي المدين", "Total debit")}</div>
          <div className="font-bold text-gray-900 mt-1">
            QR {formatMoney(totalDebit)}
          </div>
        </div>

        <div className="bg-white border rounded-2xl p-4 shadow-sm">
          <div className="text-sm text-gray-500">{tr("إجمالي الدائن", "Total credit")}</div>
          <div className="font-bold text-green-700 mt-1">
            QR {formatMoney(totalCredit)}
          </div>
        </div>

        <div className="bg-white border rounded-2xl p-4 shadow-sm">
          <div className="text-sm text-gray-500">{tr("الرصيد", "Balance")}</div>
          <div
            className={`font-bold mt-1 ${
              finalBalance > 0
                ? "text-red-700"
                : finalBalance < 0
                ? "text-green-700"
                : "text-gray-900"
            }`}
          >
            QR {formatMoney(finalBalance)}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b text-gray-600">
              <th className="p-3 text-right">{tr("التاريخ", "Date")}</th>
              <th className="p-3 text-right">{tr("النوع", "Type")}</th>
              <th className="p-3 text-right">{tr("مدين", "Debit")}</th>
              <th className="p-3 text-right">{tr("دائن", "Credit")}</th>
              <th className="p-3 text-right">{tr("الرصيد", "Balance")}</th>
            </tr>
          </thead>

          <tbody>
            {(() => {
              let balance = openingBalance;

              return (
                <>
                  <tr className="border-b bg-gray-50">
                    <td className="p-3 text-gray-400">—</td>
                    <td className="p-3 font-semibold">{tr("رصيد سابق", "Opening balance")}</td>
                    <td className="p-3">QR 0.00</td>
                    <td className="p-3">QR 0.00</td>
                    <td className="p-3 font-bold text-blue-700">
                      QR {formatMoney(openingBalance)}
                    </td>
                  </tr>

                  {filteredData.map((row) => {
                    balance += Number(row.balanceImpact ?? 0);

                    return (
                      <tr key={row.id} className="border-b hover:bg-gray-50">
                        <td className="p-3">{row.entryDate}</td>

                        <td className="p-3">
                          {row.entryType === "invoice"
                            ? tr("فاتورة", "Invoice")
                            : row.entryType === "receipt"
                            ? tr("سند قبض", "Receipt")
                            : row.entryType === "advance"
                            ? tr("دفعة مقدمة", "Advance payment")
                            : row.entryType}
                        </td>

                        <td className="p-3 font-medium">
                          QR {formatMoney(Number(row.debit || 0))}
                        </td>

                        <td className="p-3 font-medium text-green-700">
                          QR {formatMoney(Number(row.credit || 0))}
                        </td>

                        <td className="p-3 font-bold">
                          QR {formatMoney(balance)}
                        </td>
                      </tr>
                    );
                  })}

                  {filteredData.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-gray-500">
                        {tr("اختر العميل ثم اضغط بحث لعرض الحركات", "Select a client, then search to view transactions")}
                      </td>
                    </tr>
                  )}
                </>
              );
            })()}
          </tbody>
        </table>
      </div>
    </div>
  );
}
