import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import { formatCurrency } from "@/lib/utils";
import {
  Eye,
  EyeOff,
  Printer,
  Users,
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
} from "lucide-react";

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
  const { t, lang, currencySymbol } = useLanguage();
  const isAR = lang === "ar";
  const tr = (ar: string, en: string) => (isAR ? ar : en);
  const [data, setData] = useState<LedgerRow[]>([]);
  const [openingBalance, setOpeningBalance] = useState(0);
  const [clients, setClients] = useState<Client[]>([]);
  const [ledgerClient, setLedgerClient] = useState<Client | null>(null);
  const [showAmounts, setShowAmounts] = useState(false);
  const hiddenAmount = (
    <span className="tracking-widest opacity-40">••••••</span>
  );
  const [selectedClientState, setSelectedClientState] = useState<Client | null>(null);
  const [clientId, setClientId] = useState<number | "">("");
  const [hasSelectedClient, setHasSelectedClient] = useState(false);
  const [fromDate, setFromDate] = useState(() => getDefaultDateRange().from);
  const [toDate, setToDate] = useState(() => getDefaultDateRange().to);
  const [referenceSearch, setReferenceSearch] = useState("");
  const [isLoading, setIsLoading] = useState(false);

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

  (window as any).electronAPI?.openExternalPrintWindow?.(
    `#/customer-ledger/print?clientId=${effectiveClientId}&from=${fromDate}&to=${toDate}&q=${encodeURIComponent(referenceSearch)}`
  );
};

return (
  <div className="p-6 flex flex-col gap-6 max-w-7xl mx-auto" dir={isAR ? "rtl" : "ltr"}>

  {/* Header */}
  <div className="order-1 flex items-start justify-between gap-4">
    <div className={isAR ? "text-right" : "text-left"}>
      <h1 className="text-3xl font-bold text-foreground">
        {tr("ملخص العميل المالي", "Customer Financial Summary")}
      </h1>
      <p className="text-sm text-muted-foreground mt-1">
        {tr("كشف مختصر لحركات العميل والرصيد", "A brief statement of customer transactions and balance")}
      </p>
    </div>

    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setShowAmounts(v => !v)}
        className="h-[36px] px-3 rounded-xl border border-yellow-400 bg-yellow-50 text-yellow-700 hover:bg-yellow-100 transition flex items-center gap-1.5 text-[11px] font-medium shadow-sm"
      >
        {showAmounts ? (
          <EyeOff className="w-4 h-4" />
        ) : (
          <Eye className="w-4 h-4" />
        )}

        {showAmounts
          ? tr("إخفاء الأرقام", "Hide Numbers")
          : tr("إظهار الأرقام", "Show Numbers")}
      </button>

      <button
        type="button"
        onClick={openPrintPage}
        disabled={!effectiveClientId}
        className="h-[44px] px-7 rounded-xl bg-primary text-primary-foreground shadow hover:bg-primary/90 transition flex items-center gap-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Printer className="w-4 h-4" />
        {tr("الطباعة", "Print")}
      </button>
    </div>
  </div>

      {/* Filters */}

      <div className="order-3 bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border bg-muted/30 flex items-center justify-between">
          <div>
            <div className="font-semibold text-foreground">{tr("البحث والتصفية", "Search and filters")}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {tr("اختر العميل والفترة ثم اضغط بحث", "Select the client and period, then search")}
            </div>
          </div>

          <div className="text-sm text-muted-foreground">
            {data.length} {tr("حركة", "entries")}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 p-4 items-end">
          <div className="md:col-span-3">
            <label className="text-sm font-medium text-muted-foreground">{tr("العميل", "Client")}</label>
            {isClient ? (
              <div className="w-full border border-border rounded-xl px-3 py-1.5 mt-1 text-sm bg-muted/30 text-foreground min-h-[42px]">
                {selectedClient
                  ? selectedClient.nameAr || selectedClient.nameEn || selectedClient.name
                  : "â€”"}
              </div>
            ) : (
            <select
              className="w-full h-[38px] border border-border rounded-xl px-3 mt-1 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
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

          <div className="md:col-span-2">
            <label className="text-sm font-medium text-muted-foreground">
              {tr("من تاريخ", "From date")}
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full h-[38px] border border-border rounded-xl px-3 mt-1 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-sm font-medium text-muted-foreground">
              {tr("إلى تاريخ", "To date")}
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full h-[38px] border border-border rounded-xl px-3 mt-1 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          <div className="md:col-span-4">
            <label className="text-sm font-medium text-muted-foreground">
              {tr(
                "رقم الفاتورة أو سند القبض أو البيان أو البوليصة",
                "Invoice, receipt, declaration or BL number"
              )}
            </label>
            <input
              value={referenceSearch}
              onChange={(e) => setReferenceSearch(e.target.value)}
              placeholder={tr(
                "رقم الفاتورة أو سند القبض أو البيان أو البوليصة",
                "Invoice, receipt, declaration or BL number"
              )}
              className="w-full h-[38px] border border-border rounded-xl px-3 mt-1 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

         <button
            type="button"
            onClick={loadLedger}
            disabled={isSearchDisabled}
            className="md:col-span-1 h-[38px] rounded-xl bg-primary text-primary-foreground shadow hover:bg-primary/90 transition text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? tr("...", "...") : tr("بحث", "Search")}
          </button>
        </div>
      </div>

     {/* Summary */}
      <div className="order-2 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-sm text-muted-foreground">{tr("العميل", "Client")}</div>

            <div className="font-bold text-foreground mt-1 text-lg">
              {selectedClient
                ? selectedClient.nameAr || selectedClient.nameEn || selectedClient.name
                : "—"}
            </div>
          </div>

          <div className="w-12 h-12 rounded-2xl bg-violet-100 text-violet-600 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-sm text-muted-foreground">
              {tr("إجمالي المدين", "Total debit")}
            </div>

            <div className="font-bold text-red-600 mt-1 text-2xl">
              {showAmounts ? formatCurrency(totalDebit, currencySymbol, lang) : hiddenAmount}
            </div>
          </div>

          <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center">
            <ArrowDownLeft className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-sm text-muted-foreground">
              {tr("إجمالي الدائن", "Total credit")}
            </div>

            <div className="font-bold text-green-600 mt-1 text-2xl">
              {showAmounts ? formatCurrency(totalCredit, currencySymbol, lang) : hiddenAmount}
            </div>
          </div>

          <div className="w-12 h-12 rounded-2xl bg-green-100 text-green-600 flex items-center justify-center">
            <ArrowUpRight className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-sm text-muted-foreground">
              {tr("الرصيد", "Balance")}
            </div>

            <div
              className={`font-bold mt-1 text-2xl ${
                finalBalance > 0
                  ? "text-red-700"
                  : finalBalance < 0
                  ? "text-green-700"
                  : "text-foreground"
              }`}
            >
              {showAmounts ? formatCurrency(finalBalance, currencySymbol, lang) : hiddenAmount}
            </div>
          </div>

          <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center">
            <Wallet className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="order-4 bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/30 border-b border-border text-muted-foreground">
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
                  <tr className="border-b border-border bg-muted/30">
                    <td className="p-3 text-muted-foreground/60">—</td>
                    <td className="p-3 font-semibold">{tr("رصيد سابق", "Opening balance")}</td>
                    <td className="p-3">{showAmounts ? formatCurrency(0, currencySymbol, lang) : hiddenAmount}</td>
                    <td className="p-3">{showAmounts ? formatCurrency(0, currencySymbol, lang) : hiddenAmount}</td>
                    <td className="p-3 font-bold text-blue-700">
                      {showAmounts ? formatCurrency(openingBalance, currencySymbol, lang) : hiddenAmount}
                    </td>
                  </tr>

                  {filteredData.map((row) => {
                    balance += Number(row.balanceImpact ?? 0);

                    return (
                      <tr key={row.id} className="border-b border-border hover:bg-muted/50">
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
                          {showAmounts ? formatCurrency(Number(row.debit || 0), currencySymbol, lang) : hiddenAmount}
                        </td>

                        <td className="p-3 font-medium text-green-700">
                          {showAmounts ? formatCurrency(Number(row.credit || 0), currencySymbol, lang) : hiddenAmount}
                        </td>

                        <td className="p-3 font-bold">
                          {showAmounts ? formatCurrency(balance, currencySymbol, lang) : hiddenAmount}
                        </td>
                      </tr>
                    );
                  })}

                  {filteredData.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-muted-foreground">
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
