import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { useListClients, useListInvoices } from "@workspace/api-client-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { BookOpen, FileText, TrendingDown, TrendingUp, User, Printer, Eye, EyeOff } from "lucide-react";
import { useLanguage } from "@/lib/language-context";

export default function StatementsIndex() {
  const { t, lang } = useLanguage();
  const isAR = lang === "ar";
  const [showAmounts, setShowAmounts] = useState(false);
  const hidden = <span className="tracking-widest opacity-35 font-mono">••••••</span>;
  const { data: clients, isLoading: loadingClients } = useListClients();
  const { data: allInvoices, isLoading: loadingInvoices } = useListInvoices();

  const loading = loadingClients || loadingInvoices;

  const clientSummaries = (clients?.map(client => {
    const invoices = allInvoices?.filter(inv => inv.clientId === client.id) || [];
    const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.total, 0);
    const totalPaid = invoices.filter(i => i.status === "paid").reduce((sum, inv) => sum + inv.total, 0);
    const balance = totalInvoiced - totalPaid;
    const lastInvoice = invoices.sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime())[0];
    return { client, totalInvoiced, totalPaid, balance, invoiceCount: invoices.length, lastInvoice };
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
          <p className="text-muted-foreground text-sm mt-0.5">{t("statementsDesc")}</p>
        </div>
        <button
          onClick={() => setShowAmounts(v => !v)}
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
            <p className="text-2xl font-black font-mono mt-0.5">{showAmounts ? formatCurrency(totalReceived) : hidden}</p>
          </div>
        </div>
        <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-xl text-red-500 dark:text-red-400 flex-shrink-0">
            <TrendingDown className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("totalOutstandingLabel")}</p>
            <p className="text-2xl font-black font-mono text-destructive mt-0.5">{showAmounts ? formatCurrency(totalOutstanding) : hidden}</p>
          </div>
        </div>
      </div>

      {/* Clients Table */}
      <div className="bg-card border border-border/50 shadow-sm rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-border/50 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-primary" />
          <h2 className="font-bold text-base">{t("allClientsStatement")}</h2>
        </div>
        <div className="overflow-x-auto overflow-y-auto max-h-[360px]">
          <table className="w-full text-sm">
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
                clientSummaries.map(({ client, totalInvoiced, totalPaid, balance, invoiceCount, lastInvoice }) => (
                  <tr key={client.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-4">
                      <Link href={`/clients/${client.id}`}>
                        <p className="font-semibold text-primary hover:underline cursor-pointer">{client.name}</p>
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
                      {lastInvoice ? formatDate(lastInvoice.issueDate) : "—"}
                    </td>
                    <td className="px-5 py-4 font-mono font-semibold">{showAmounts ? formatCurrency(totalInvoiced) : hidden}</td>
                    <td className="px-5 py-4 font-mono font-semibold text-emerald-600 dark:text-emerald-400">{showAmounts ? formatCurrency(totalPaid) : hidden}</td>
                    <td className="px-5 py-4">
                      <span className={`font-mono font-bold text-base ${balance > 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"}`}>
                        {showAmounts ? formatCurrency(balance) : hidden}
                      </span>
                      {balance > 0 && (
                        <p className="text-xs text-destructive/70 mt-0.5">{t("outstandingLabel")}</p>
                      )}
                      {balance <= 0 && invoiceCount > 0 && (
                        <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70 mt-0.5">{t("settledLabel")}</p>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <Link href={`/clients/${client.id}`}>
                          <button className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground rounded-lg font-semibold text-xs transition-all">
                            <BookOpen className="w-3.5 h-3.5" />
                            {t("viewStatement")}
                          </button>
                        </Link>
                      <button
                      onClick={() => window.open(`/clients/${client.id}/statement`, "_blank")}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-muted text-muted-foreground hover:bg-foreground hover:text-background rounded-lg font-semibold text-xs transition-all"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      {t("print")}
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
                    {showAmounts ? formatCurrency(clientSummaries.reduce((s, c) => s + c.totalInvoiced, 0)) : hidden}
                  </td>
                  <td className="px-5 py-4 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {showAmounts ? formatCurrency(totalReceived) : hidden}
                  </td>
                  <td className="px-5 py-4 font-mono font-bold text-destructive">
                    {showAmounts ? formatCurrency(totalOutstanding) : hidden}
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </motion.div>
  );
}
