import { describeDatePeriod } from "@/lib/date-period-description";
import ResizableScrollArea from "@/components/layout/ResizableScrollArea";
import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { useListClients, useListInvoices, useListReceipts } from "@workspace/api-client-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { BookOpen, FileText, TrendingDown, TrendingUp, User, Printer, Eye, EyeOff, Search } from "lucide-react";
import { useLanguage } from "@/lib/language-context";

import type { Client, Invoice } from "@workspace/api-client-react";


interface ClientSummary {
  client: Client;
  totalInvoiced: number;
  totalPaid: number;
  balance: number;
  invoiceCount: number;
  lastInvoice?: Invoice;
}

export default function StatementsIndex() {
  const { t, lang, currencySymbol } = useLanguage();
  const isAR = lang === "ar";
  const [showAmounts, setShowAmounts] = useState(false);
  const [rowAmountVisibility, setRowAmountVisibility] = useState<Record<number, boolean>>({});
  const rowAmountsVisible = (id: number) => rowAmountVisibility[id] ?? showAmounts;
  const toggleRowAmounts = (id: number) => {
    setRowAmountVisibility(prev => ({
      ...prev,
      [id]: !(prev[id] ?? showAmounts),
    }));
  };
  const [searchTerm, setSearchTerm] = useState("");
  const [fromDate, setFromDate] = useState(() => {
    const today = new Date();
    const from = new Date(today.getFullYear(), today.getMonth() - 6, 1);
    const lastDay = new Date(from.getFullYear(), from.getMonth() + 1, 0).getDate();
    from.setDate(Math.min(today.getDate(), lastDay));
    return `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, "0")}-${String(from.getDate()).padStart(2, "0")}`;
  });
  const [toDate, setToDate] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  });
  const hidden = <span className="tracking-widest opacity-35 font-mono">••••••</span>;
  const { data: clients, isLoading: loadingClients } = useListClients();
  const { data: allInvoices, isLoading: loadingInvoices } = useListInvoices();
  const { data: receipts = [], isLoading: loadingReceipts } = useListReceipts();

  const receivedByInvoice = new Map<number, number>();
    for (const receipt of receipts) {
      if (receipt.status !== "issued" || receipt.invoiceId == null) continue;

      const invoiceId = Number(receipt.invoiceId);
      receivedByInvoice.set(
        invoiceId,
        (receivedByInvoice.get(invoiceId) ?? 0) + Number(receipt.amount || 0),
      );
    }

  const loading = loadingClients || loadingInvoices || loadingReceipts;

  const clientSummaries: ClientSummary[] = (clients?.map((client: Client) => {
    const invoices = allInvoices?.filter((inv: Invoice) => {
    if (inv.clientId !== client.id) return false;

    const issueDate = String(inv.issueDate || "").slice(0, 10);

    const search = searchTerm.trim().toLowerCase();

    const matchesSearch =
      !search ||
      String(client.name || "").toLowerCase().includes(search) ||
      String((inv as any).shipmentRef || "").toLowerCase().includes(search) ||
      String((inv as any).blNumber || "").toLowerCase().includes(search) ||
      String((inv as any).invoiceNumber || "").toLowerCase().includes(search);

    return (
      (!fromDate || issueDate >= fromDate) &&
      (!toDate || issueDate <= toDate) &&
      matchesSearch
    );
    }) || [];

    const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.total, 0);
    const totalPaid = invoices.reduce(
        (sum, inv) =>
          sum +
          Number((inv as Invoice & { advancePayment?: number }).advancePayment ?? 0) +
          (receivedByInvoice.get(inv.id) ?? 0),
          0,
          );
    const balance = totalInvoiced - totalPaid;

    const lastInvoice = [...invoices].sort(
      (a, b) =>
        new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime()
    )[0];

    return {
      client,
      totalInvoiced,
      totalPaid,
      balance,
      invoiceCount: invoices.length,
      lastInvoice,
    };
  }) ?? [])
    .filter(c => c.invoiceCount > 0)
    .sort((a, b) => b.balance - a.balance);

  const totalOutstanding = clientSummaries.reduce((sum, c) => sum + Math.max(c.balance, 0), 0);
  const totalReceived = clientSummaries.reduce((sum, c) => sum + c.totalPaid, 0);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">


      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("statements")}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{lang === "ar" ? "ملخص أرصدة جميع العملاء" : "Summary of all client balances"} {describeDatePeriod(fromDate, toDate, lang)}</p>
        </div>
        <button
          onClick={() => { setShowAmounts(v => !v); setRowAmountVisibility({}); }}
          className={`self-start sm:self-auto flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-all ${
            showAmounts
              ? "bg-card border-border text-muted-foreground hover:bg-muted/40"
              : "bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400"
          }`}
        >
          {showAmounts ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          {showAmounts ? (isAR ? "إخفاء الأرقام" : "Hide Numbers") : (isAR ? "إظهار الأرقام" : "Show Numbers")}
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-xl text-primary flex-shrink-0">
            <User className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("totalClients")}</p>
            <p className="text-2xl font-black mt-0.5">{clientSummaries.length}</p>
          </div>
        </div>
        <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl text-emerald-600 dark:text-emerald-400 flex-shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("totalCollectedLabel")}</p>
            <p className="text-2xl font-black font-mono mt-0.5">{showAmounts ? formatCurrency(totalReceived, currencySymbol, lang) : hidden}</p>
          </div>
        </div>
        <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-xl text-red-500 dark:text-red-400 flex-shrink-0">
            <TrendingDown className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("totalOutstandingLabel")}</p>
            <p className="text-2xl font-black font-mono text-destructive mt-0.5">{showAmounts ? formatCurrency(totalOutstanding, currencySymbol, lang) : hidden}</p>
          </div>
        </div>
      </div>

      {/* Search and date range stay visible together. */}
      <div dir={isAR ? "rtl" : "ltr"} className="bg-card rounded-lg border border-border shadow-sm px-3 py-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="flex shrink-0 items-center gap-2 text-sm font-semibold text-foreground">
            <Search className="h-4 w-4 text-primary" />
            <span>{isAR ? "البحث" : "Search"}</span>
          </div>
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1 sm:min-w-[280px]">
              <Search className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input type="text" autoComplete="off" name="ledger-statement-search"
                value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                aria-label={isAR ? "رقم البيان أو البوليصة أو اسم العميل أو رقم الفاتورة" : "Declaration, bill of lading, client or invoice number"}
                placeholder={isAR ? "رقم البيان / البوليصة / اسم العميل / رقم الفاتورة" : "Declaration / B/L / client / invoice number"}
                className="h-8 w-full ps-3 pe-9 rounded-lg border border-border bg-muted/40 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>{isAR ? "من" : "From"}</span>
              <input type="date" dir="ltr" aria-label={isAR ? "من" : "From"}
                value={fromDate} onChange={(e) => setFromDate(e.target.value)}
                className="h-8 w-[140px] px-2 rounded-lg border border-border bg-muted/40 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </label>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>{isAR ? "إلى" : "To"}</span>
              <input type="date" dir="ltr" aria-label={isAR ? "إلى" : "To"}
                value={toDate} onChange={(e) => setToDate(e.target.value)}
                className="h-8 w-[140px] px-2 rounded-lg border border-border bg-muted/40 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </label>
          </div>
        </div>
      </div>

      {/* Clients Table */}
      <div className="bg-card border border-border/50 shadow-sm rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-border/50 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-primary" />
          <h2 className="font-bold text-base">{t("allClientsStatement")}</h2>
        </div>
        <ResizableScrollArea storageKey="statements-index" maxHeight={360}>
          <table className="w-full text-sm [&_th]:text-center [&_td]:text-center [&_th]:align-middle [&_td]:align-middle [&_th]:whitespace-nowrap [&_th]:px-3 [&_td]:px-3">
            <thead className="bg-muted/40 text-muted-foreground font-semibold border-b border-border/50 text-xs uppercase tracking-wider sticky top-0 z-10">
              <tr>
                <th className="px-5 py-3.5 text-start">{t("clientName")}</th>
                <th className="px-5 py-3.5 text-start">{t("invoiceCount")}</th>
                <th className="px-5 py-3.5 text-start">{t("lastInvoiceCol")}</th>
                <th className="px-5 py-3.5 text-start">{t("totalInvoicedCol")}</th>
                <th className="px-5 py-3.5 text-start">{t("collectedCol")}</th>
                <th className="px-5 py-3.5 text-start">{t("outstandingBalance")}</th>
                <th className="px-5 py-3.5 text-start">{t("statementCol")}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array(5).fill(0).map((_, i) => (
                  <tr key={i} className="border-b border-border/50">
                    {Array(7).fill(0).map((_, j) => (
                      <td key={j} className="px-5 py-4">
                        <div className="h-4 bg-muted rounded-md animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : clientSummaries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-16 text-muted-foreground">
                    <User className="w-10 h-10 mx-auto mb-3 opacity-25" />
                    <p className="text-sm">{t("noClientsStatements")}</p>
                  </td>
                </tr>
              ) : (
                clientSummaries.map(({
                  client,
                  totalInvoiced,
                  totalPaid,
                  balance,
                  invoiceCount,
                  lastInvoice,
                }: ClientSummary) => (
                  <tr key={client.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-4">
                      <Link href={`/clients/${client.id}`}>
                        <p className="font-semibold text-primary hover:underline cursor-pointer">
                          {client.name}
                        </p>
                      </Link>
                      {client.phone && <p className="text-xs text-muted-foreground mt-0.5">{client.phone}</p>}
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1 bg-muted px-2.5 py-1 rounded-full text-xs font-semibold">
                        <FileText className="w-3 h-3" />
                        {invoiceCount}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-muted-foreground text-xs">
                      {lastInvoice ? formatDate(lastInvoice.issueDate, lang) : "—"}
                    </td>
                    <td className="px-5 py-4 font-mono font-semibold">{rowAmountsVisible(client.id) ? formatCurrency(totalInvoiced, currencySymbol, lang) : hidden}</td>
                    <td className="px-5 py-4 font-mono font-semibold text-emerald-600 dark:text-emerald-400">{rowAmountsVisible(client.id) ? formatCurrency(totalPaid, currencySymbol, lang) : hidden}</td>
                    <td className="px-5 py-4">
                      <span className={`font-mono font-bold text-base ${balance > 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"}`}>
                        {rowAmountsVisible(client.id) ? formatCurrency(balance, currencySymbol, lang) : hidden}
                      </span>
                      {balance > 0 && (
                        <p className="text-xs text-destructive/70 mt-0.5">{t("outstandingLabel")}</p>
                      )}
                      {balance <= 0 && invoiceCount > 0 && (
                        <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70 mt-0.5">{t("settledLabel")}</p>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-center gap-2 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => toggleRowAmounts(client.id)}
                          aria-pressed={rowAmountsVisible(client.id)}
                          aria-label={`${rowAmountsVisible(client.id) ? (isAR ? "إخفاء الأرقام" : "Hide Numbers") : (isAR ? "إظهار الأرقام" : "Show Numbers")} — ${client.name}`}
                          title={rowAmountsVisible(client.id) ? (isAR ? "إخفاء أرقام السطر" : "Hide row amounts") : (isAR ? "إظهار أرقام السطر" : "Show row amounts")}
                          className="inline-flex items-center justify-center w-8 h-8 shrink-0 rounded-lg text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-900/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                        >
                          {rowAmountsVisible(client.id) ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                        <Link href={`/clients/${client.id}`}>
                          <button type="button" title={t("viewStatement")} aria-label={`${t("viewStatement")} — ${client.name}`} className="inline-flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                            <BookOpen className="w-3.5 h-3.5" />

                          </button>
                        </Link>
                      <button
                      onClick={() => {
                          window.electronAPI?.openExternalPrintWindow?.(
                            `#/clients/${client.id}/statement?from=${fromDate}&to=${toDate}`
                          );
                        }}
                      type="button" title={t("print")} aria-label={`${t("print")} — ${client.name}`} className="inline-flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-violet-50 dark:bg-violet-950/30 text-violet-600 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-900/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                    >
                      <Printer className="w-3.5 h-3.5" />

                    </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {clientSummaries.length > 0 && (
              <tfoot className="border-t-2 border-border bg-muted/30">
                <tr>
                  <td colSpan={3} className="px-5 py-4 font-bold text-foreground">{t("grandTotal")}</td>
                  <td className="px-5 py-4 font-mono font-bold">
                    {showAmounts ? formatCurrency(clientSummaries.reduce((s, c) => s + c.totalInvoiced, 0), currencySymbol, lang) : hidden}
                  </td>
                  <td className="px-5 py-4 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {showAmounts ? formatCurrency(totalReceived, currencySymbol, lang) : hidden}
                  </td>
                  <td className="px-5 py-4 font-mono font-bold text-destructive">
                    {showAmounts ? formatCurrency(totalOutstanding, currencySymbol, lang) : hidden}
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </ResizableScrollArea>
      </div>
    </motion.div>
  );
}
